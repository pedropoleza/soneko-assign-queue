// stevo-retry — reprocessa a fila stevo_pending_ops (block/unblock que falharam
// por erro transitório/plataforma do Stevo). Disparada por pg_cron a cada 15 min.
// Protegida por header x-retry-secret (comparado com stevo_settings.retry_secret).
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const STEVO_TIMEOUT_MS = 15000;
const BATCH = 50;
const MAX_BACKOFF_MIN = 360; // 6h

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function stevoFetch(serverUrl: string, apiKey: string, path: string, bodyObj: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STEVO_TIMEOUT_MS);
  try {
    const r = await fetch(`${serverUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    const text = await r.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const msg = data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error) : `HTTP ${r.status}`;
      return { ok: false, error: msg.split(apiKey).join('[REDACTED]').slice(0, 300) };
    }
    return { ok: true, data };
  } catch (err) {
    const t = err instanceof Error && err.name === 'AbortError';
    return { ok: false, error: t ? 'Timeout ao chamar a instância' : 'Falha de rede' };
  } finally { clearTimeout(timeout); }
}

async function attempt(serverUrl: string, apiKey: string, action: string, phone: string): Promise<{ ok: boolean; error?: string }> {
  // Resolve para o LID (formato aceito pelo Stevo; trata 9º dígito BR).
  const chk = await stevoFetch(serverUrl, apiKey, '/user/check', { number: [phone], formatJid: true });
  let number = phone;
  if (chk.ok && chk.data && typeof chk.data === 'object') {
    const u = (chk.data as { data?: { Users?: Array<{ IsInWhatsapp?: boolean; JID?: string; LID?: string }> } })?.data?.Users?.[0];
    if (u && u.IsInWhatsapp === false) return { ok: false, error: `Número ${phone} não está no WhatsApp` };
    if (u) number = u.LID ?? u.JID ?? phone;
  }
  const res = await stevoFetch(serverUrl, apiKey, `/user/${action}`, { number });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

Deno.serve(async (req) => {
  const secret = req.headers.get('x-retry-secret') ?? '';
  const { data: setting } = await supabase.from('stevo_settings').select('value').eq('key', 'retry_secret').maybeSingle();
  if (!setting || secret !== setting.value) return json({ error: 'não autorizado' }, 401);

  const nowIso = new Date().toISOString();
  const { data: ops, error } = await supabase
    .from('stevo_pending_ops')
    .select('id, action, phone, contact_id, source, reason, attempts, ghl_location_id, instance_name, stevo_instances ( server_url, api_key, active )')
    .eq('status', 'pending')
    .lte('next_attempt_at', nowIso)
    .order('next_attempt_at', { ascending: true })
    .limit(BATCH);
  if (error) return json({ error: 'erro ao ler fila' }, 500);

  let done = 0, stillFailing = 0;
  for (const op of ops ?? []) {
    const inst = op.stevo_instances as unknown as { server_url: string; api_key: string; active: boolean } | null;
    if (!inst || !inst.active) continue;

    const r = await attempt(inst.server_url, inst.api_key, op.action, op.phone);
    const now = new Date().toISOString();

    if (r.ok) {
      done++;
      await supabase.from('stevo_pending_ops').update({ status: 'done', resolved_at: now, updated_at: now, last_error: null }).eq('id', op.id);
      await supabase.from('stevo_audit_log').insert({
        action: op.action, ghl_location_id: op.ghl_location_id, contact_id: op.contact_id, phone: op.phone,
        instance_name: op.instance_name, success: true, message: 'OK (retry)', source: op.source ?? 'retry', reason: op.reason ?? '',
      });
    } else {
      stillFailing++;
      const attempts = (op.attempts ?? 0) + 1;
      const backoffMin = Math.min(15 * attempts, MAX_BACKOFF_MIN);
      const next = new Date(Date.now() + backoffMin * 60 * 1000).toISOString();
      // Falha permanente (número não existe no WhatsApp): encerra a pendência.
      const permanent = (r.error ?? '').includes('não está no WhatsApp');
      await supabase.from('stevo_pending_ops').update(
        permanent
          ? { status: 'done', resolved_at: now, updated_at: now, last_error: r.error, attempts }
          : { attempts, last_error: r.error, next_attempt_at: next, updated_at: now }
      ).eq('id', op.id);
    }
  }

  return json({ processed: (ops ?? []).length, done, stillFailing });
});
