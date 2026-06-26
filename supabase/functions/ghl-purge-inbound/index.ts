// GHL purge-inbound — event-driven cleaner. NO polling, NO cron, NO lists.
//
// A single GHL "Contact Created" workflow fires a webhook here with the new
// contact id. We evaluate that ONE contact in real time and delete it only if it
// was auto-created by a channel integration (deleting a contact also removes its
// conversation). Manual / import / form contacts are always kept.
//
// Discriminator = GHL's native `createdBy.source`:
//   INTEGRATION  → channel-auto-created (WhatsApp/IG/FB/SMS)  → delete
//   WEB_USER/MANUAL → added in "New"                          → keep
//   null/BULK_ACTION → import                                 → keep
//   FORM/SURVEY → form submission                             → keep
// A blocked-channel conversation is required as confirmation (guards
// non-messaging integrations); set require_channel_conversation=false to skip it.
//
// Audit: only real outcomes (deleted / delete_failed — and everything while in
// dry-run) are written to ghl.purge_log, so the table stays clean.
//
// Config in ghl.purge_config (ghl_purge_config RPC), tunable from SQL.
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
  keep_tags: string[];
  purge_channel_types: string[];
  purge_created_by_sources: string[];
  require_channel_conversation: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function fetchConversations(cfg: Config, contactId: string): Promise<any[]> {
  try {
    const data = await ghl(cfg.pit_token, `/conversations/search?locationId=${cfg.location_id}&contactId=${contactId}`);
    return data?.conversations ?? [];
  } catch {
    return [];
  }
}

function blockedConversation(conv: any, patterns: string[]): string | null {
  const t = `${conv?.type ?? ''} ${conv?.lastMessageType ?? ''}`.toLowerCase();
  const hit = patterns.find((p) => p && t.includes(p));
  return hit ? (conv.type ?? conv.lastMessageType ?? hit) : null;
}

async function decide(contact: any, cfg: Config): Promise<{ purge: boolean; reason: string; createdBy: string }> {
  const createdBy = String(contact?.createdBy?.source ?? '').toUpperCase();

  const keep = cfg.keep_tags.map((t) => t.toLowerCase());
  const tags = (contact.tags ?? []).map((t: unknown) => String(t).toLowerCase());
  if (keep.some((k) => tags.includes(k))) return { purge: false, reason: 'keep_tag', createdBy };

  const delList = cfg.purge_created_by_sources.map((s) => s.toUpperCase());
  if (!delList.includes(createdBy)) return { purge: false, reason: `created_by:${createdBy || 'none'}`, createdBy };

  if (!cfg.require_channel_conversation) return { purge: true, reason: `created_by:${createdBy}`, createdBy };

  // Confirm a blocked-channel conversation. On Contact Created the conversation
  // can take a couple of seconds to be queryable, so retry a few times (the only
  // wait in the whole system — bounded, on real channel contacts only).
  const patterns = cfg.purge_channel_types.map((p) => p.toLowerCase()).filter(Boolean);
  const waits = [0, 2500, 3500];
  for (const w of waits) {
    if (w) await sleep(w);
    const convs = await fetchConversations(cfg, contact.id);
    const hit = convs.map((c) => blockedConversation(c, patterns)).find(Boolean);
    if (hit) return { purge: true, reason: `${createdBy}+conversation:${hit}`, createdBy };
    if (convs.length > 0) break; // has conversations, none blocked → not a channel contact
  }
  return { purge: false, reason: 'no_channel_conversation', createdBy };
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

  const decision = await decide(contact, cfg);
  const createdBy = decision.createdBy || null;
  let action = decision.purge ? (cfg.dry_run ? 'would_delete' : 'deleted') : 'kept';

  if (decision.purge && !cfg.dry_run) {
    try {
      await ghl(cfg.pit_token, `/contacts/${contactId}`, 'DELETE');
    } catch (e) {
      action = 'delete_failed';
    }
  }

  // Audit only meaningful outcomes (keep the table clean): all decisions while in
  // dry-run for validation, but in live mode only actual deletions / failures.
  if (cfg.dry_run || decision.purge) {
    await supabase.rpc('ghl_purge_log', {
      p_contact_id: String(contactId), p_action: action, p_reason: decision.reason,
      p_source: createdBy, p_channel: body.channel ?? null, p_dry_run: cfg.dry_run,
    });
  }

  return json(200, { action, reason: decision.reason, createdBy, dry_run: cfg.dry_run, contact_id: contactId });
});
