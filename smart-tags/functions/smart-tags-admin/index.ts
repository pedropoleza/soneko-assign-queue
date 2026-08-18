// Smart Tags — API administrativa (instalação por subaccount).
// Auth: header x-smarttags-admin com o admin secret.
//
//   POST /smart-tags-admin/install    { location_id, pit_token, field_name?, ... }
//   POST /smart-tags-admin/sync       { location_id? }
//   POST /smart-tags-admin/backfill   { location_id, max_pages?, start_after?, start_after_id? }
//   POST /smart-tags-admin/uninstall  { location_id }
//   POST /smart-tags-admin/settings   { location_id, ...campos }
//   GET  /smart-tags-admin/status?location_id=...
//   GET  /smart-tags-admin/accounts
import {
  Account,
  accountByLocation,
  applyValueToOpportunity,
  db,
  ensureField,
  ghl,
  json,
  mapLimit,
  normalizeTagNames,
  rpc,
  runFullSync,
  searchOpportunities,
  tagKey,
} from './core.ts';

const BACKFILL_PAGE_SIZE = 100;
const BACKFILL_TIME_BUDGET_MS = 90_000;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/smart-tags-admin\/?/, '').replace(/\/$/, '') || 'status';

  if (req.method === 'GET' && route === '') return json(200, { ok: true, service: 'smart-tags-admin' });

  const client = db();
  const adminSecret = req.headers.get('x-smarttags-admin') ?? url.searchParams.get('admin');
  if (!(await rpc<boolean>(client, 'smarttags_admin_check', { p_secret: adminSecret }))) {
    return json(401, { error: 'unauthorized' });
  }

  let body: Record<string, any> = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const locationId: string | null = body.location_id ?? url.searchParams.get('location_id') ?? null;

  try {
    switch (route) {
      case 'install':
        return await install(client, body);

      case 'settings': {
        if (!locationId) return json(400, { error: 'location_id_obrigatorio' });
        const account = await rpc<Account>(client, 'smarttags_upsert_account', {
          p_location_id: locationId,
          p_pit_token: body.pit_token ?? null,
          p_name: body.name ?? null,
          p_field_name: body.field_name ?? null,
          p_field_data_type: body.field_data_type ?? null,
          p_sync_options: body.sync_options ?? null,
          p_sync_values: body.sync_values ?? null,
          p_prune_options: body.prune_options ?? null,
          p_ignore_prefixes: body.ignore_prefixes ?? null,
          p_active: body.active ?? null,
        });
        return json(200, { ok: true, account: redact(account) });
      }

      case 'sync': {
        if (locationId) {
          const account = await accountByLocation(client, locationId);
          if (!account) return json(404, { error: 'account_not_found' });
          return json(200, { ok: true, ...(await runFullSync(client, account, 'manual')) });
        }
        const accounts = await rpc<Account[]>(client, 'smarttags_list_accounts', { p_only_active: true });
        const results = [];
        for (const account of accounts ?? []) {
          try {
            results.push({ ok: true, ...(await runFullSync(client, account, 'manual')) });
          } catch (e) {
            results.push({ ok: false, location_id: account.ghl_location_id, error: (e as Error).message });
          }
        }
        return json(200, { ok: true, results });
      }

      case 'backfill': {
        if (!locationId) return json(400, { error: 'location_id_obrigatorio' });
        const account = await accountByLocation(client, locationId);
        if (!account) return json(404, { error: 'account_not_found' });
        return json(200, await backfill(client, account, body));
      }

      case 'uninstall': {
        if (!locationId) return json(400, { error: 'location_id_obrigatorio' });
        const account = await rpc<Account>(client, 'smarttags_upsert_account', {
          p_location_id: locationId,
          p_active: false,
        });
        return json(200, { ok: true, account: redact(account) });
      }

      case 'accounts': {
        const accounts = await rpc<Account[]>(client, 'smarttags_list_accounts', {
          p_only_active: body.only_active ?? url.searchParams.get('only_active') !== 'false',
        });
        return json(200, { ok: true, accounts: (accounts ?? []).map(redact) });
      }

      case 'status': {
        if (!locationId) return json(400, { error: 'location_id_obrigatorio' });
        const status = await rpc(client, 'smarttags_status', { p_location_id: locationId });
        return json(200, { ok: true, ...status, webhook_url: webhookUrl() });
      }

      default:
        return json(404, { error: 'rota_desconhecida', route });
    }
  } catch (e) {
    return json(200, { ok: false, error: (e as Error).message });
  }
});

function redact(account: Account | null) {
  if (!account) return null;
  const { pit_token: _pit, ...rest } = account;
  return rest;
}

function webhookUrl() {
  const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  return `${base}/functions/v1/smart-tags-webhook`;
}

// ---------------------------------------------------------------------------
// Install: valida o token, grava a conta, provisiona o campo e roda o 1º sync
// ---------------------------------------------------------------------------
async function install(client: ReturnType<typeof db>, body: Record<string, any>) {
  const locationId: string = body.location_id ?? '';
  const pit: string = body.pit_token ?? '';
  if (!locationId || !pit) return json(400, { error: 'location_id_e_pit_token_obrigatorios' });

  // Valida o token antes de gravar qualquer coisa.
  let locationName: string | null = body.name ?? null;
  try {
    const loc = await ghl<any>(pit, `/locations/${locationId}`);
    locationName = locationName ?? loc?.location?.name ?? null;
  } catch (e) {
    return json(200, { ok: false, error: `token_invalido: ${(e as Error).message}` });
  }

  const account = await rpc<Account>(client, 'smarttags_upsert_account', {
    p_location_id: locationId,
    p_pit_token: pit,
    p_name: locationName,
    p_field_name: body.field_name ?? null,
    p_field_data_type: body.field_data_type ?? null,
    p_sync_options: body.sync_options ?? null,
    p_sync_values: body.sync_values ?? null,
    p_prune_options: body.prune_options ?? null,
    p_ignore_prefixes: body.ignore_prefixes ?? null,
    p_active: true,
  });

  const stats = await runFullSync(client, account, 'install');

  return json(200, {
    ok: true,
    account: redact(account),
    sync: stats,
    webhook: {
      url: webhookUrl(),
      header: 'x-smarttags-secret',
      secret: account.webhook_secret,
      body: {
        location_id: '{{location.id}}',
        contact_id: '{{contact.id}}',
        tags: '{{contact.tags}}',
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Backfill: carimba as oportunidades já existentes. Resumível por cursor.
// ---------------------------------------------------------------------------
async function backfill(client: ReturnType<typeof db>, account: Account, body: Record<string, any>) {
  const runId = await rpc<string>(client, 'smarttags_start_run', {
    p_account_id: account.id,
    p_trigger: 'backfill',
  });

  const started = Date.now();
  let startAfter: number | null = body.start_after ?? null;
  let startAfterId: string | null = body.start_after_id ?? null;
  let scanned = 0;
  let updated = 0;
  let pages = 0;
  let total: number | undefined;
  let done = false;

  try {
    const field = await ensureField(client, account);
    const optionKeys = new Set((field.picklistOptions ?? []).map(tagKey));
    const maxPages = Math.max(1, Math.min(Number(body.max_pages ?? 5), 50));

    while (pages < maxPages) {
      const page = await searchOpportunities(account, {
        limit: BACKFILL_PAGE_SIZE,
        startAfter,
        startAfterId,
      });
      total = page.total ?? total;
      pages++;
      scanned += page.opportunities.length;

      if (page.opportunities.length === 0) {
        done = true;
        break;
      }

      const writes = await mapLimit(page.opportunities, 4, async (opp) => {
        const tags = normalizeTagNames(opp.contact?.tags ?? [], account.ignore_prefixes)
          .filter((t) => optionKeys.has(tagKey(t)));
        return await applyValueToOpportunity(account, field, opp, tags);
      });
      updated += writes.filter(Boolean).length;

      startAfter = page.startAfter ?? null;
      startAfterId = page.startAfterId ?? null;
      if (!startAfterId) {
        done = true;
        break;
      }
      if (Date.now() - started > BACKFILL_TIME_BUDGET_MS) break;
    }

    await rpc(client, 'smarttags_finish_run', {
      p_run_id: runId,
      p_status: 'ok',
      p_stats: {
        opportunities_updated: updated,
        details: { scanned, pages, done, start_after: startAfter, start_after_id: startAfterId },
      },
    });

    return {
      ok: true,
      done,
      scanned,
      updated,
      pages,
      total,
      // Repita a chamada com esse cursor até done = true.
      next: done ? null : { start_after: startAfter, start_after_id: startAfterId },
    };
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    await rpc(client, 'smarttags_finish_run', {
      p_run_id: runId,
      p_status: 'error',
      p_stats: { opportunities_updated: updated, details: { scanned, pages } },
      p_error: message,
    });
    return { ok: false, error: message, scanned, updated, next: { start_after: startAfter, start_after_id: startAfterId } };
  }
}
