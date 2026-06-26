// GHL purge-inbound — delete ONLY contacts auto-created by an inbound channel.
//
// GoHighLevel creates a contact (+ conversation) on any inbound message and
// there's no native way to stop it. The fix is the TRIGGER: the GHL workflow
// fires this webhook on **Contact Created** (not on every inbound message), so it
// only ever evaluates BRAND-NEW contacts — a pre-existing manual/form contact who
// later messages on a channel never triggers it and is never touched.
//
// The function is then safe-by-default: it deletes a contact ONLY when its source
// positively matches a configured inbound-channel pattern (WhatsApp/IG/FB/SMS).
// Form / manual / imported / blank / unknown sources are always kept.
//
// Config lives in ghl.purge_config (ghl_purge_config RPC), tunable from SQL:
//   pit_token, purge_secret, dry_run (default true), max_age_sec,
//   keep_tags, purge_source_patterns.
// Every decision is written to ghl.purge_log for auditing during dry-run.
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
  purge_source_patterns: string[];
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

// Safe-by-default: a contact is ONLY deleted when its source positively matches
// one of the configured inbound-channel patterns. Forms, manual, imports, blank
// or any unrecognized source are always kept — so a legitimate contact is never
// removed (the worst case is an unwanted one slipping through, which we then tune
// for via the dry-run logs by adding its source string to purge_source_patterns).
function evaluate(contact: any, cfg: Config): { purge: boolean; reason: string } {
  const keep = cfg.keep_tags.map((t) => t.toLowerCase());
  const tags = (contact.tags ?? []).map((t: unknown) => String(t).toLowerCase());
  if (keep.some((k) => tags.includes(k))) return { purge: false, reason: 'keep_tag' };

  const source = String(contact.source ?? '').toLowerCase();
  const patterns = cfg.purge_source_patterns.map((p) => p.toLowerCase()).filter(Boolean);
  const hit = patterns.find((p) => source.includes(p));
  if (!hit) return { purge: false, reason: `source_not_channel:${source || 'blank'}` };

  // Replay protection: never delete an old contact (the trigger is Contact
  // Created, so a real inbound contact is always brand-new).
  const addedAt = Date.parse(contact.dateAdded ?? contact.createdAt ?? contact.dateCreated ?? '');
  if (!Number.isNaN(addedAt) && (Date.now() - addedAt) / 1000 > cfg.max_age_sec) {
    return { purge: false, reason: 'too_old' };
  }

  return { purge: true, reason: `inbound_channel:${hit}` };
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
