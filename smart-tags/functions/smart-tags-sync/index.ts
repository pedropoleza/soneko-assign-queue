// Smart Tags — reconciliador.
// O GHL não emite webhook de "tag criada": tag nova feita em Settings → Tags
// só aparece aqui. Roda via pg_cron (todas as contas) ou sob demanda.
//
// Auth:
//   header x-smarttags-admin: <admin secret>   -> todas as contas ativas
//   header x-smarttags-secret: <webhook secret> + ?location_id=  -> uma conta
import { Account, accountByLocation, db, isAdmin, json, rpc, runFullSync, secretMatches } from './core.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'GET' && new URL(req.url).searchParams.size === 0) {
    return json(200, { ok: true, service: 'smart-tags-sync' });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(405, { error: 'method_not_allowed' });
  }

  const url = new URL(req.url);
  const client = db();
  const adminSecret = req.headers.get('x-smarttags-admin') ?? url.searchParams.get('admin') ?? null;
  const accountSecret = req.headers.get('x-smarttags-secret') ?? url.searchParams.get('secret') ?? null;

  let body: Record<string, any> = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const locationId = body.location_id ?? url.searchParams.get('location_id') ?? null;

  // ---- uma conta só, autenticada pelo webhook secret ----------------------
  if (!(await isAdmin(client, adminSecret))) {
    if (!accountSecret || !locationId) return json(401, { error: 'unauthorized' });

    const account = await accountByLocation(client, locationId);
    if (!account || !secretMatches(account.webhook_secret, accountSecret)) {
      return json(401, { error: 'unauthorized' });
    }
    if (!account.active) return json(200, { ok: false, error: 'account_inactive' });

    try {
      const stats = await runFullSync(client, account, 'manual');
      return json(200, { ok: true, ...stats });
    } catch (e) {
      return json(200, { ok: false, error: (e as Error).message });
    }
  }

  // ---- admin: uma location ou todas ---------------------------------------
  if (locationId) {
    const account = await accountByLocation(client, locationId);
    if (!account) return json(404, { error: 'account_not_found' });
    try {
      const stats = await runFullSync(client, account, body.trigger === 'cron' ? 'cron' : 'manual');
      return json(200, { ok: true, ...stats });
    } catch (e) {
      return json(200, { ok: false, location_id: locationId, error: (e as Error).message });
    }
  }

  const accounts = await rpc<Account[]>(client, 'smarttags_list_accounts', { p_only_active: true });
  const results: unknown[] = [];

  for (const account of accounts ?? []) {
    try {
      const stats = await runFullSync(client, account, 'cron');
      results.push({ ok: true, ...stats });
    } catch (e) {
      results.push({ ok: false, location_id: account.ghl_location_id, error: (e as Error).message });
    }
  }

  return json(200, { ok: true, accounts: results.length, results });
});
