// Smart Tags — núcleo compartilhado pelas três edge functions.
// Implantado junto de cada index.ts como ./core.ts

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const GHL_API_BASE = 'https://services.leadconnectorhq.com';
export const GHL_API_VERSION = '2021-07-28';

// Tipos de campo do GHL que aceitam picklist.
export const OPTION_FIELD_TYPES = ['MULTIPLE_OPTIONS', 'SINGLE_OPTIONS', 'CHECKBOX'];
// Tipos que aceitam mais de um valor ao mesmo tempo.
export const MULTI_VALUE_TYPES = ['MULTIPLE_OPTIONS', 'CHECKBOX'];

export type Account = {
  id: string;
  ghl_location_id: string;
  name: string | null;
  pit_token: string;
  webhook_secret: string;
  field_id: string | null;
  field_key: string | null;
  field_name: string;
  field_data_type: string;
  sync_options: boolean;
  sync_values: boolean;
  prune_options: boolean;
  ignore_prefixes: string[];
  active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
};

export type GhlField = {
  id: string;
  name: string;
  model: string;
  fieldKey: string;
  dataType: string;
  picklistOptions?: string[];
};

export type GhlTag = { id?: string; name: string };

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export class GhlError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`ghl_${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chamada à API do GHL com retry em 429 / 5xx. */
export async function ghl<T = any>(
  pit: string,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${pit}`,
    'Version': GHL_API_VERSION,
    'Accept': 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${GHL_API_BASE}${path}`, { ...init, headers });

  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await sleep(500 * Math.pow(2, attempt));
    return ghl<T>(pit, path, init, attempt + 1);
  }

  const text = await res.text();
  if (!res.ok) throw new GhlError(res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

export function db(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export async function rpc<T = any>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function isAdmin(client: SupabaseClient, secret: string | null): Promise<boolean> {
  if (!secret) return false;
  return await rpc<boolean>(client, 'smarttags_admin_check', { p_secret: secret });
}

export async function accountByLocation(
  client: SupabaseClient,
  locationId: string,
): Promise<Account | null> {
  const row = await rpc<Account | null>(client, 'smarttags_account_by_location', {
    p_location_id: locationId,
  });
  return row ?? null;
}

/** Comparação de secrets em tempo constante. */
export function secretMatches(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Nomes de tag
// ---------------------------------------------------------------------------

export const tagKey = (name: string) => name.trim().toLowerCase();

/** Normaliza, deduplica por nome e aplica a lista de prefixos ignorados. */
export function normalizeTagNames(names: unknown, ignorePrefixes: string[] = []): string[] {
  const list = Array.isArray(names)
    ? names
    : typeof names === 'string'
    // O GHL renderiza {{contact.tags}} como string separada por vírgula.
    ? names.split(',')
    : [];

  const ignored = (ignorePrefixes ?? []).map(tagKey).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    if (!name) continue;
    const key = tagKey(name);
    if (seen.has(key)) continue;
    if (ignored.some((p) => key.startsWith(p))) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Custom field de oportunidade
// ---------------------------------------------------------------------------

export async function listOpportunityFields(account: Account): Promise<GhlField[]> {
  const res = await ghl<{ customFields?: GhlField[] }>(
    account.pit_token,
    `/locations/${account.ghl_location_id}/customFields?model=opportunity`,
  );
  return (res.customFields ?? []).filter((f) => f.model === 'opportunity');
}

/**
 * Resolve o custom field alvo: usa o field_id salvo, senão procura pelo nome,
 * senão cria. Persiste o id/key resolvido na conta.
 */
export async function ensureField(
  client: SupabaseClient,
  account: Account,
  seedOptions: string[] = [],
): Promise<GhlField> {
  const fields = await listOpportunityFields(account);

  let field = account.field_id ? fields.find((f) => f.id === account.field_id) ?? null : null;
  if (!field) {
    const wanted = tagKey(account.field_name);
    field = fields.find((f) => tagKey(f.name) === wanted) ?? null;
  }

  if (!field) {
    const created = await ghl<{ customField: GhlField }>(
      account.pit_token,
      `/locations/${account.ghl_location_id}/customFields`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: account.field_name,
          dataType: account.field_data_type,
          placeholder: '',
          position: 0,
          model: 'opportunity',
          options: dedupeOptions(seedOptions),
        }),
      },
    );
    field = created.customField;
  }

  if (!OPTION_FIELD_TYPES.includes(field.dataType)) {
    throw new Error(
      `field_type_invalido: "${field.name}" é ${field.dataType}; ` +
        `use um de ${OPTION_FIELD_TYPES.join(', ')}`,
    );
  }

  if (field.id !== account.field_id || field.fieldKey !== account.field_key) {
    await rpc(client, 'smarttags_set_field', {
      p_account_id: account.id,
      p_field_id: field.id,
      p_field_key: field.fieldKey,
      p_field_name: field.name,
    });
    account.field_id = field.id;
    account.field_key = field.fieldKey;
    account.field_data_type = field.dataType;
  }

  return field;
}

function dedupeOptions(options: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of options) {
    const name = (o ?? '').trim();
    if (!name) continue;
    const key = tagKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export type OptionSyncResult = {
  changed: boolean;
  before: number;
  after: number;
  added: string[];
  removed: string[];
  options: string[];
};

/**
 * Garante que todo nome de tag exista como opção do custom field.
 * Preserva a ordem das opções já existentes e acrescenta as novas em ordem
 * alfabética. Só remove opções quando prune_options está ligado.
 */
export async function syncFieldOptions(
  account: Account,
  field: GhlField,
  tagNames: string[],
): Promise<OptionSyncResult> {
  const current = dedupeOptions(field.picklistOptions ?? []);
  const currentKeys = new Set(current.map(tagKey));
  const wanted = dedupeOptions(tagNames);
  const wantedKeys = new Set(wanted.map(tagKey));

  const added = wanted
    .filter((n) => !currentKeys.has(tagKey(n)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const removed = account.prune_options
    ? current.filter((n) => !wantedKeys.has(tagKey(n)))
    : [];

  if (added.length === 0 && removed.length === 0) {
    return { changed: false, before: current.length, after: current.length, added, removed, options: current };
  }

  const removedKeys = new Set(removed.map(tagKey));
  const options = [...current.filter((n) => !removedKeys.has(tagKey(n))), ...added];

  await ghl(
    account.pit_token,
    `/locations/${account.ghl_location_id}/customFields/${field.id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        name: field.name,
        placeholder: '',
        model: 'opportunity',
        options,
      }),
    },
  );

  field.picklistOptions = options;
  return { changed: true, before: current.length, after: options.length, added, removed, options };
}

// ---------------------------------------------------------------------------
// Oportunidades
// ---------------------------------------------------------------------------

export type GhlOpportunity = {
  id: string;
  name?: string;
  contactId?: string;
  customFields?: Array<{
    id: string;
    fieldValue?: unknown;
    fieldValueArray?: unknown;
    value?: unknown;
  }>;
  contact?: { id?: string; tags?: string[] };
};

export type OpportunityPage = {
  opportunities: GhlOpportunity[];
  startAfter?: number | null;
  startAfterId?: string | null;
  total?: number;
};

export async function searchOpportunities(
  account: Account,
  opts: { contactId?: string; limit?: number; startAfter?: number | null; startAfterId?: string | null } = {},
): Promise<OpportunityPage> {
  const qs = new URLSearchParams({ location_id: account.ghl_location_id });
  qs.set('limit', String(opts.limit ?? 100));
  if (opts.contactId) qs.set('contact_id', opts.contactId);
  if (opts.startAfter != null) qs.set('startAfter', String(opts.startAfter));
  if (opts.startAfterId) qs.set('startAfterId', opts.startAfterId);

  const res = await ghl<{ opportunities?: GhlOpportunity[]; meta?: Record<string, any> }>(
    account.pit_token,
    `/opportunities/search?${qs.toString()}`,
  );

  return {
    opportunities: res.opportunities ?? [],
    startAfter: res.meta?.startAfter ?? null,
    startAfterId: res.meta?.startAfterId ?? null,
    total: res.meta?.total,
  };
}

/** Lê o valor atual do campo numa oportunidade, já normalizado para array. */
export function currentFieldValues(opp: GhlOpportunity, fieldId: string): string[] {
  const entry = (opp.customFields ?? []).find((f) => f.id === fieldId);
  if (!entry) return [];
  const raw = entry.fieldValueArray ?? entry.fieldValue ?? entry.value;
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string' && raw.trim()) return [raw];
  return [];
}

const sameValues = (a: string[], b: string[]) => {
  const sa = [...a].map(tagKey).sort();
  const sb = [...b].map(tagKey).sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
};

/**
 * Escreve as tags do contato no custom field da oportunidade.
 * Retorna true se houve escrita (false quando o valor já estava correto).
 */
export async function applyValueToOpportunity(
  account: Account,
  field: GhlField,
  opp: GhlOpportunity,
  tagNames: string[],
): Promise<boolean> {
  const multi = MULTI_VALUE_TYPES.includes(field.dataType);
  const desired = multi ? dedupeOptions(tagNames) : dedupeOptions(tagNames).slice(0, 1);
  const current = currentFieldValues(opp, field.id);

  if (sameValues(current, desired)) return false;

  await ghl(account.pit_token, `/opportunities/${opp.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      customFields: [{ id: field.id, field_value: multi ? desired : (desired[0] ?? '') }],
    }),
  });
  return true;
}

// ---------------------------------------------------------------------------
// Sincronização completa (cron / manual / install)
// ---------------------------------------------------------------------------

export async function listLocationTags(account: Account): Promise<GhlTag[]> {
  const res = await ghl<{ tags?: GhlTag[] }>(
    account.pit_token,
    `/locations/${account.ghl_location_id}/tags`,
  );
  return res.tags ?? [];
}

export type SyncStats = {
  location_id: string;
  tags_seen: number;
  tags_new: string[];
  options_before: number;
  options_after: number;
  options_added: string[];
  options_removed: string[];
  field_id: string;
  field_key: string | null;
  changed: boolean;
};

/**
 * Lê o catálogo completo de tags da location, registra no banco e reconcilia
 * as opções do custom field. É o caminho que pega tags criadas direto em
 * Settings → Tags, que não disparam webhook nenhum no GHL.
 */
export async function runFullSync(
  client: SupabaseClient,
  account: Account,
  trigger: 'cron' | 'manual' | 'install',
): Promise<SyncStats> {
  const runId = await rpc<string>(client, 'smarttags_start_run', {
    p_account_id: account.id,
    p_trigger: trigger,
  });

  try {
    const tags = await listLocationTags(account);
    const names = normalizeTagNames(tags.map((t) => t.name), account.ignore_prefixes);
    const keep = new Set(names.map(tagKey));

    const recorded = await rpc<{ new: string[]; seen: number; total: number }>(
      client,
      'smarttags_record_tags',
      {
        p_account_id: account.id,
        p_tags: tags.filter((t) => keep.has(tagKey(t.name ?? ''))).map((t) => ({ name: t.name, id: t.id ?? null })),
        p_source: 'poll',
        p_mark_missing: true,
      },
    );

    const field = await ensureField(client, account, names);

    let result: OptionSyncResult = {
      changed: false,
      before: (field.picklistOptions ?? []).length,
      after: (field.picklistOptions ?? []).length,
      added: [],
      removed: [],
      options: field.picklistOptions ?? [],
    };

    if (account.sync_options) {
      result = await syncFieldOptions(account, field, names);
      await rpc(client, 'smarttags_mark_options', {
        p_account_id: account.id,
        p_names: result.options,
      });
    }

    const stats: SyncStats = {
      location_id: account.ghl_location_id,
      tags_seen: recorded?.seen ?? names.length,
      tags_new: recorded?.new ?? [],
      options_before: result.before,
      options_after: result.after,
      options_added: result.added,
      options_removed: result.removed,
      field_id: field.id,
      field_key: field.fieldKey ?? null,
      changed: result.changed,
    };

    await rpc(client, 'smarttags_finish_run', {
      p_run_id: runId,
      p_status: 'ok',
      p_stats: {
        tags_seen: stats.tags_seen,
        tags_new: stats.tags_new.length,
        options_before: stats.options_before,
        options_after: stats.options_after,
        options_added: stats.options_added,
        options_removed: stats.options_removed,
        details: { field_id: field.id, field_key: field.fieldKey, new_tags: stats.tags_new },
      },
    });
    await rpc(client, 'smarttags_touch_sync', { p_account_id: account.id, p_status: 'ok' });

    return stats;
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    await rpc(client, 'smarttags_finish_run', {
      p_run_id: runId,
      p_status: 'error',
      p_stats: {},
      p_error: message,
    });
    await rpc(client, 'smarttags_touch_sync', { p_account_id: account.id, p_status: 'error' });
    throw e;
  }
}

/** Roda tarefas com concorrência limitada, para respeitar o rate limit do GHL. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
