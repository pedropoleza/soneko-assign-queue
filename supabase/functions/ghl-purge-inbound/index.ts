// GHL purge-inbound — keep ONLY contacts created manually or via forms.
//
// GoHighLevel always creates a contact (+ conversation) on any inbound message
// (WhatsApp, Instagram DM, Facebook, SMS, …). There is no native way to stop
// that, so this function is the cleanup: a GHL Workflow fires a webhook here on
// inbound messages, and we DELETE the just-created contact (deleting a contact
// removes its conversations too) — unless it's a keeper (form/manual).
//
// Config lives in ghl.purge_config (read via the ghl_purge_config RPC), so it can
// be populated / tuned / armed entirely from SQL:
//   pit_token     Private Integration token (contacts read+write) of the location
//   purge_secret  shared secret; the workflow sends it as x-purge-secret
//   dry_run       true (default) logs only; false actually deletes
//   max_age_sec   only purge contacts created within this window (recency guard)
//   keep_tags     tags that always protect a contact
//
// Every decision is written to ghl.purge_log for easy auditing during dry-run.
//
// verify_jwt MUST be false (authenticated via purge_secret).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

type Config = {
  location_id: string;
  pit_token: string;
  purge_secret: string;
  dry_run: boolean;
  max_age_sec: number;
  keep_tags: string[];
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function ghl(pit: string, path: string, method = 'GET') {
  const r = await fetch(`${GHL_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${pit}`, Version: GHL_VERSION, Accept: 'application/json' },
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  if (!r.ok) throw new Error(`ghl_${r.status}: ${text.slice(0, 200)}`);
  return data;
}

function evaluate(contact: any, cfg: Config): { purge: boolean; reason: string } {
  const keep = cfg.keep_tags.map((t) => t.toLowerCase());
  const tags = (contact.tags ?? []).map((t: unknown) => String(t).toLowerCase());
  if (keep.some((k) => tags.includes(k))) return { purge: false, reason: 'keep_tag' };

  // Recency guard — an existing contact who merely replied is never purged.
  const addedAt = Date.parse(contact.dateAdded ?? contact.createdAt ?? contact.dateCreated ?? '');
  if (!Number.isNaN(addedAt)) {
    const ageSec = (Date.now() - addedAt) / 1000;
    if (ageSec > cfg.max_age_sec) return { purge: false, reason: `too_old_${Math.round(ageSec)}s` };
  }

  // Positive protection for form / manual / imported origins.
  const source = String(contact.source ?? '').toLowerCase();
  if (/form|survey|manual|import|csv|bulk|api/.test(source)) return { purge: false, reason: `source:${source}` };

  return { purge: true, reason: `inbound:${source || 'unknown'}` };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const { data: cfgData } = await supabase.rpc('ghl_purge_config');
  const cfg = cfgData as Config | null;
  if (!cfg || !cfg.purge_secret) return json(500, { error: 'config_unavailable' });

  const secret = req.headers.get('x-purge-secret') ?? new URL(req.url).searchParams.get('secret') ?? '';
  if (secret !== cfg.purge_secret) return json(401, { error: 'unauthorized' });
  if (!cfg.pit_token) return json(500, { error: 'missing_pit_token' });

  const body = await req.json().catch(() => ({}));
  const contactId = body.contact_id ?? body.contactId ?? body.id;
  if (!contactId) return json(400, { error: 'missing_contact_id' });

  let contact: any;
  try {
    const res = await ghl(cfg.pit_token, `/contacts/${contactId}`);
    contact = res?.contact ?? res;
  } catch (e) {
    return json(502, { error: 'ghl_fetch_failed', detail: (e as Error).message });
  }
  if (!contact?.id) return json(404, { error: 'contact_not_found', contact_id: contactId });

  const decision = evaluate(contact, cfg);
  const source = contact.source ?? null;
  const channel = body.channel ?? null;
  let action = decision.purge ? (cfg.dry_run ? 'would_delete' : 'deleted') : 'kept';

  if (decision.purge && !cfg.dry_run) {
    try {
      await ghl(cfg.pit_token, `/contacts/${contactId}`, 'DELETE');
    } catch (e) {
      action = 'delete_failed';
      await supabase.rpc('ghl_purge_log', {
        p_contact_id: contactId, p_action: action, p_reason: (e as Error).message,
        p_source: source, p_channel: channel, p_dry_run: cfg.dry_run,
      });
      return json(502, { error: 'ghl_delete_failed', detail: (e as Error).message, contact_id: contactId });
    }
  }

  await supabase.rpc('ghl_purge_log', {
    p_contact_id: contactId, p_action: action, p_reason: decision.reason,
    p_source: source, p_channel: channel, p_dry_run: cfg.dry_run,
  });

  return json(200, {
    action, reason: decision.reason, dry_run: cfg.dry_run,
    contact_id: contactId, name: contact.contactName ?? null, source, channel,
  });
});
