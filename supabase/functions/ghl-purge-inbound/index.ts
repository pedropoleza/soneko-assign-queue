// GHL purge-inbound — delete ONLY contacts that entered via a channel CONVERSATION.
//
// GoHighLevel creates a contact (+ conversation) on any inbound message and
// there's no native way to stop it. This is a self-contained cleaner — NO GHL
// workflow required:
//
//   • A scheduled scan (pg_cron → POST {mode:"scan"}) lists contacts created in
//     the last `scan_window_sec`, and evaluates each one (deduped via purge_log).
//     (A GHL "Contact Created" webhook posting {contact_id} also works, if used.)
//   • Decisive signal: does the contact have an inbound CONVERSATION on a blocked
//     channel (WhatsApp/IG/FB/SMS/…)? Contacts added in "New" by hand or via
//     IMPORT have no conversation → kept. Form submissions aren't conversations →
//     kept. Only channel-created contacts have one → deleted.
//
// Safe-by-default: anything not positively a channel conversation is kept.
// Dry-run by default; every decision is written to ghl.purge_log.
//
// Config (ghl.purge_config / ghl_purge_config RPC), tunable from SQL:
//   pit_token (Contacts + Conversations scopes), purge_secret, dry_run,
//   max_age_sec, keep_tags, purge_channel_types, scan_window_sec.
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
  purge_channel_types: string[];
  scan_window_sec: number;
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

async function decide(contact: any, cfg: Config, allowRetry: boolean): Promise<{ purge: boolean; reason: string }> {
  const keep = cfg.keep_tags.map((t) => t.toLowerCase());
  const tags = (contact.tags ?? []).map((t: unknown) => String(t).toLowerCase());
  if (keep.some((k) => tags.includes(k))) return { purge: false, reason: 'keep_tag' };

  const source = String(contact.source ?? '').toLowerCase();
  if (/form|survey|manual|import|csv|bulk|opportunity/.test(source)) return { purge: false, reason: `source:${source}` };

  const addedAt = Date.parse(contact.dateAdded ?? contact.createdAt ?? contact.dateCreated ?? '');
  if (!Number.isNaN(addedAt) && (Date.now() - addedAt) / 1000 > cfg.max_age_sec) {
    return { purge: false, reason: 'too_old' };
  }

  const patterns = cfg.purge_channel_types.map((p) => p.toLowerCase()).filter(Boolean);
  let convs = await fetchConversations(cfg, contact.id);
  let hit = convs.map((c) => blockedConversation(c, patterns)).find(Boolean);

  // The conversation can lag the creation event — retry once (webhook path only).
  if (allowRetry && !hit && convs.length === 0) {
    await new Promise((r) => setTimeout(r, 4000));
    convs = await fetchConversations(cfg, contact.id);
    hit = convs.map((c) => blockedConversation(c, patterns)).find(Boolean);
  }

  if (hit) return { purge: true, reason: `conversation:${hit}` };
  return { purge: false, reason: convs.length ? 'conversation_not_blocked' : 'no_conversation' };
}

async function processContact(contactId: string, cfg: Config, channel: string | null, allowRetry: boolean) {
  let contact: any;
  try {
    const res = await ghl(cfg.pit_token, `/contacts/${contactId}`);
    contact = res?.contact ?? res;
  } catch (e) {
    return { contact_id: contactId, action: 'fetch_failed', reason: (e as Error).message };
  }
  if (!contact?.id) return { contact_id: contactId, action: 'not_found', reason: 'not_found' };

  const decision = await decide(contact, cfg, allowRetry);
  const source = contact.source ?? null;
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
      return { contact_id: contactId, action, reason: (e as Error).message };
    }
  }

  await supabase.rpc('ghl_purge_log', {
    p_contact_id: contactId, p_action: action, p_reason: decision.reason,
    p_source: source, p_channel: channel, p_dry_run: cfg.dry_run,
  });
  return { contact_id: contactId, action, reason: decision.reason, source };
}

async function runScan(cfg: Config) {
  let list: any[] = [];
  try {
    const data = await ghl(cfg.pit_token, `/contacts/?locationId=${cfg.location_id}&limit=100`);
    list = data?.contacts ?? [];
  } catch (e) {
    return json(502, { mode: 'scan', error: 'list_failed', detail: (e as Error).message });
  }

  const cutoff = Date.now() - cfg.scan_window_sec * 1000;
  const recent = list.filter((c) => {
    const t = Date.parse(c.dateAdded ?? c.dateUpdated ?? '');
    return !Number.isNaN(t) && t >= cutoff;
  });

  const results: any[] = [];
  for (const c of recent) {
    const { data: seen } = await supabase.rpc('ghl_purge_already', { p_contact_id: c.id });
    if (seen) continue;
    results.push(await processContact(c.id, cfg, null, false));
  }
  return json(200, { mode: 'scan', scanned: recent.length, acted: results.length, dry_run: cfg.dry_run, results });
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

  if (body.mode === 'scan') return runScan(cfg);

  const contactId = body.contact_id ?? body.contactId ?? body.id;
  if (!contactId) return json(400, { error: 'missing_contact_id' });
  const result = await processContact(String(contactId), cfg, body.channel ?? null, true);
  return json(200, { dry_run: cfg.dry_run, ...result });
});
