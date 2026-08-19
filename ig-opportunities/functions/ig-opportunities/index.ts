// IG Opportunities — reconciliador.
// Lê as conversas de Instagram já sincronizadas no GHL e cria uma oportunidade
// (Pré venda / Instagram) para cada seguidor que ainda não tem — uma vez por
// seguidor, para sempre. Captura tanto ManyChat quanto Direct manual, porque
// ambos chegam ao GHL como conversa de Instagram.
//
// Aciona via pg_cron (todas as contas) ou sob demanda:
//   header x-igopps-admin: <admin secret>
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const PAGE_SIZE = 100;
const MAX_PAGES = 25;               // teto por execução (25 * 100 = 2500 conversas)
const TIME_BUDGET_MS = 120_000;
const CREATE_CONCURRENCY = 4;

type Account = {
  id: string;
  ghl_location_id: string;
  name: string | null;
  pit_token: string;
  pipeline_id: string;
  stage_id: string;
  opportunity_source: string;
  name_template: string;
  require_inbound: boolean;
  only_after: string;
  cursor_ms: number;
  enabled: boolean;
};

type Conversation = {
  id: string;
  contactId?: string;
  fullName?: string;
  contactName?: string;
  lastMessageDate?: number;
  lastMessageDirection?: string;
  opportunities?: unknown[];
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ghl<T = any>(pit: string, path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
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
  if (!res.ok) throw new Error(`ghl_${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function db(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

async function rpc<T = any>(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function searchIgConversations(
  account: Account,
  startAfterMs: number,
): Promise<Conversation[]> {
  const qs = new URLSearchParams({
    locationId: account.ghl_location_id,
    lastMessageType: 'TYPE_INSTAGRAM',
    sortBy: 'last_message_date',
    sort: 'asc',
    limit: String(PAGE_SIZE),
    startAfterDate: String(startAfterMs),
  });
  const res = await ghl<{ conversations?: Conversation[] }>(
    account.pit_token,
    `/conversations/search?${qs.toString()}`,
  );
  return res.conversations ?? [];
}

/** Confere se a conversa tem alguma mensagem inbound (exigido só se require_inbound). */
async function hasInbound(account: Account, conversationId: string): Promise<boolean> {
  const res = await ghl<any>(
    account.pit_token,
    `/conversations/${conversationId}/messages?limit=50`,
  );
  const msgs = res?.messages?.messages ?? res?.messages ?? [];
  return Array.isArray(msgs) && msgs.some((m: any) => String(m?.direction).toLowerCase() === 'inbound');
}

async function createOpportunity(account: Account, contactId: string, name: string): Promise<string> {
  const res = await ghl<any>(account.pit_token, `/opportunities/`, {
    method: 'POST',
    body: JSON.stringify({
      locationId: account.ghl_location_id,
      pipelineId: account.pipeline_id,
      pipelineStageId: account.stage_id,
      contactId,
      name,
      status: 'open',
      source: account.opportunity_source,
    }),
  });
  return (res.opportunity ?? res)?.id ?? '';
}

type RunStats = {
  location_id: string;
  conversations: number;
  created: number;
  existing: number;
  skipped: number;
  cursor_before: number;
  cursor_after: number;
  capped: boolean;
};

async function reconcile(
  client: SupabaseClient,
  account: Account,
  trigger: 'cron' | 'manual' | 'backfill',
): Promise<RunStats> {
  const onlyAfterMs = Date.parse(account.only_after) || 0;
  const cursorBefore = Math.max(account.cursor_ms ?? 0, onlyAfterMs);
  const runId = await rpc<string>(client, 'igopps_start_run', {
    p_account_id: account.id,
    p_trigger: trigger,
    p_cursor: cursorBefore,
  });

  const started = Date.now();
  let startAfter = cursorBefore;
  let cursorAfter = cursorBefore;
  let seen = 0, created = 0, existing = 0, skipped = 0, pages = 0;
  let capped = false;

  try {
    while (pages < MAX_PAGES) {
      const convs = await searchIgConversations(account, startAfter);
      pages++;
      if (convs.length === 0) break;

      // Processa em concorrência limitada; a ordem asc garante retomada segura.
      const results = await mapLimit(convs, CREATE_CONCURRENCY, async (conv) => {
        return await processConversation(client, account, conv);
      });

      for (let k = 0; k < convs.length; k++) {
        seen++;
        const r = results[k];
        if (r === 'created') created++;
        else if (r === 'existing') existing++;
        else skipped++;
        const ts = convs[k].lastMessageDate ?? 0;
        if (ts > cursorAfter) cursorAfter = ts;
      }

      // Avança o cursor incrementalmente (retomada segura se bater o teto).
      startAfter = convs[convs.length - 1].lastMessageDate ?? startAfter;
      await rpc(client, 'igopps_set_cursor', { p_account_id: account.id, p_cursor_ms: cursorAfter });

      if (convs.length < PAGE_SIZE) break;          // drenou tudo
      if (Date.now() - started > TIME_BUDGET_MS) { capped = true; break; }
      if (pages >= MAX_PAGES) { capped = true; break; }
    }

    const stats: RunStats = {
      location_id: account.ghl_location_id,
      conversations: seen, created, existing, skipped,
      cursor_before: cursorBefore, cursor_after: cursorAfter, capped,
    };

    await rpc(client, 'igopps_finish_run', {
      p_run_id: runId,
      p_status: 'ok',
      p_stats: {
        conversations: seen, created, existing, skipped,
        cursor_after: cursorAfter,
        details: { pages, capped },
      },
    });
    await rpc(client, 'igopps_touch_run', { p_account_id: account.id, p_status: 'ok' });
    return stats;
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    await rpc(client, 'igopps_finish_run', {
      p_run_id: runId,
      p_status: 'error',
      p_stats: { conversations: seen, created, existing, skipped, cursor_after: cursorAfter },
      p_error: message,
    });
    await rpc(client, 'igopps_touch_run', { p_account_id: account.id, p_status: 'error' });
    throw e;
  }
}

async function processConversation(
  client: SupabaseClient,
  account: Account,
  conv: Conversation,
): Promise<'created' | 'existing' | 'skipped'> {
  const contactId = conv.contactId;
  if (!contactId) return 'skipped';

  const handle = conv.contactName ?? null;
  const name = (account.name_template || '{name}').replace(
    '{name}',
    conv.fullName || conv.contactName || 'Instagram Lead',
  );

  // Reserva atômica: garante "uma vez por seguidor, para sempre".
  const claimed = await rpc<boolean>(client, 'igopps_claim_contact', {
    p_account_id: account.id,
    p_contact_id: contactId,
  });
  if (!claimed) return 'skipped';   // já processado num run anterior

  try {
    // Se o contato já tem oportunidade, não duplica — só registra.
    if (Array.isArray(conv.opportunities) && conv.opportunities.length > 0) {
      await rpc(client, 'igopps_record_result', {
        p_account_id: account.id, p_contact_id: contactId,
        p_conversation_id: conv.id, p_contact_name: name, p_ig_handle: handle,
        p_opportunity_id: null, p_outcome: 'existing',
      });
      return 'existing';
    }

    // Regra opcional: exigir resposta do seguidor antes de criar.
    if (account.require_inbound && !(await hasInbound(account, conv.id))) {
      // Libera a reserva para reconsiderar quando ele responder.
      await rpc(client, 'igopps_release_contact', { p_account_id: account.id, p_contact_id: contactId });
      return 'skipped';
    }

    const oppId = await createOpportunity(account, contactId, name);
    await rpc(client, 'igopps_record_result', {
      p_account_id: account.id, p_contact_id: contactId,
      p_conversation_id: conv.id, p_contact_name: name, p_ig_handle: handle,
      p_opportunity_id: oppId, p_outcome: 'created',
    });
    return 'created';
  } catch (e) {
    // Falhou: libera a reserva para tentar de novo no próximo run.
    await rpc(client, 'igopps_release_contact', { p_account_id: account.id, p_contact_id: contactId });
    throw e;
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === 'GET' && url.searchParams.size === 0) {
    return json(200, { ok: true, service: 'ig-opportunities' });
  }
  if (req.method !== 'POST' && req.method !== 'GET') return json(405, { error: 'method_not_allowed' });

  const client = db();
  const adminSecret = req.headers.get('x-igopps-admin') ?? url.searchParams.get('admin');
  if (!(await rpc<boolean>(client, 'igopps_admin_check', { p_secret: adminSecret }))) {
    return json(401, { error: 'unauthorized' });
  }

  let body: Record<string, any> = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { body = {}; }
  }
  const locationId: string | null = body.location_id ?? url.searchParams.get('location_id') ?? null;
  const trigger = body.trigger === 'cron' ? 'cron' : body.trigger === 'backfill' ? 'backfill' : 'manual';

  const accounts = await rpc<Account[]>(client, 'igopps_list_accounts', { p_only_enabled: true });
  const targets = (accounts ?? []).filter((a) => !locationId || a.ghl_location_id === locationId);
  if (locationId && targets.length === 0) return json(404, { error: 'account_not_found' });

  const results: unknown[] = [];
  for (const account of targets) {
    try {
      results.push({ ok: true, ...(await reconcile(client, account, trigger)) });
    } catch (e) {
      results.push({ ok: false, location_id: account.ghl_location_id, error: (e as Error).message });
    }
  }
  return json(200, { ok: true, accounts: results.length, results });
});
