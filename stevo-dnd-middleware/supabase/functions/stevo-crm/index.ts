// stevo-crm — remoção de contatos no GoHighLevel para contatos marcados como
// DND. Guarda uma "lista de remoção" por location e deleta o contato via API
// do GHL. Quando o contato reentra (trigger Contact Created do GHL dispara um
// webhook para cá), verifica a lista e deleta de novo.
//
// POST { action, locationId, contactId, phone, name, source, reason, webhookSecret? }
//   action remove/dnd/block/delete   -> marca na lista + deleta agora (se tiver contactId)
//   action restore/unblock/dnd_off   -> desativa a marca (não deleta mais)
//   action created/contact_created   -> se estiver na lista, deleta o contato
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
const GHL_TIMEOUT_MS = 15000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message: string, status: number): Response {
  return json({ success: false, status: 'error', message }, status);
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a); const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

/** Normaliza telefone para dígitos com DDI (mesma regra do stevo-dnd). */
function normalizePhone(raw: unknown): string {
  if (!raw || typeof raw !== 'string') throw new Error('Telefone ausente');
  let d = raw.replace(/\D+/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length < 10) throw new Error(`Telefone inválido: "${raw}"`);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length > 15) throw new Error(`Telefone inválido: "${raw}"`);
  return d;
}

/**
 * Variações do telefone para casar mesmo com a ambiguidade do 9º dígito
 * brasileiro (WhatsApp/GHL ora usam com o 9, ora sem). Ex.:
 *   5538984216014  <->  553884216014
 */
function phoneVariants(phone: string): string[] {
  const set = new Set<string>([phone]);
  if (phone.startsWith('55')) {
    const rest = phone.slice(2); // DDD + número
    if (rest.length === 11 && rest[2] === '9') {
      set.add('55' + rest.slice(0, 2) + rest.slice(3)); // remove o 9
    } else if (rest.length === 10) {
      set.add('55' + rest.slice(0, 2) + '9' + rest.slice(2)); // adiciona o 9
    }
  }
  return [...set];
}

/** DELETE /contacts/{id} no GHL. Não vaza o token em mensagens. */
async function ghlDeleteContact(token: string, contactId: string): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GHL_TIMEOUT_MS);
  try {
    const res = await fetch(`${GHL_BASE}/contacts/${encodeURIComponent(contactId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    if (res.status === 404) return { ok: true }; // já não existe -> objetivo cumprido
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text);
      msg = String(j.message ?? j.error ?? msg);
    } catch { /* mantém msg */ }
    return { ok: false, error: msg.split(token).join('[REDACTED]').slice(0, 300) };
  } catch (err) {
    const t = err instanceof Error && err.name === 'AbortError';
    return { ok: false, error: t ? 'Timeout ao chamar a API do GHL' : 'Falha de rede ao chamar a API do GHL' };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'GET') return json({ status: 'ok', service: 'stevo-crm' });
  if (req.method !== 'POST') return errorResponse('Método não permitido', 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return errorResponse('Body JSON inválido', 400); }

  const cd = body.customData && typeof body.customData === 'object' ? (body.customData as Record<string, unknown>) : {};
  const pick = (k: string): unknown => (body[k] !== undefined ? body[k] : cd[k]);
  const clean = (v: unknown): string =>
    typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : v === undefined || v === null ? '' : String(v).trim();

  // A ação pode vir na URL (?action=remove), no body ou no customData.
  // Sem ação explícita => 'check' (reentrada: deleta se estiver listado).
  const qAction = new URL(req.url).searchParams.get('action') ?? '';
  const raw = (qAction || clean(pick('action'))).toLowerCase();
  const kind: 'remove' | 'restore' | 'check' =
    raw.includes('restore') || raw.includes('unblock') || raw.includes('off') ? 'restore'
    : raw.includes('remove') || raw.includes('delete') || raw.includes('block') || raw.includes('dnd') ? 'remove'
    : 'check';

  // Aceita camelCase, snake_case do GHL e "location" como objeto {id}.
  const locObj = pick('location');
  const locationId =
    clean(pick('locationId')) || clean(pick('location_id')) ||
    (locObj && typeof locObj === 'object' ? clean((locObj as Record<string, unknown>).id) : clean(locObj));
  const contactId = clean(pick('contactId')) || clean(pick('contact_id'));
  const name =
    clean(pick('name')) || clean(pick('full_name')) ||
    [clean(pick('first_name')), clean(pick('last_name'))].filter(Boolean).join(' ');
  const reason = clean(pick('reason'));
  if (!locationId) return errorResponse('Payload inválido — locationId é obrigatório (envie location.id)', 400);

  const { data: client, error: cErr } = await supabase
    .from('stevo_clients')
    .select('id, webhook_secret, ghl_api_token, active')
    .eq('ghl_location_id', locationId)
    .maybeSingle();
  if (cErr) return errorResponse('Erro interno ao consultar configuração', 500);
  if (!client || !client.active) return errorResponse(`Location "${locationId}" não está configurada`, 404);

  const providedSecret =
    (req.headers.get('x-webhook-secret') ?? '') ||
    clean(pick('webhookSecret')) || clean(pick('secret')) || clean(pick('x-webhook-secret'));
  if (!providedSecret || !safeEqual(providedSecret, client.webhook_secret)) {
    return errorResponse('Segredo do webhook ausente ou inválido', 401);
  }

  let phone = '';
  try { phone = normalizePhone(pick('phone')); } catch { phone = ''; }
  const variants = phone ? phoneVariants(phone) : [];
  const nowIso = new Date().toISOString();

  // ── restore: desativa a marca de remoção (qualquer variação do número) ───
  if (kind === 'restore') {
    if (!phone) return errorResponse('Telefone é obrigatório para restaurar', 400);
    await supabase.from('stevo_removal_list')
      .update({ active: false, updated_at: nowIso })
      .eq('ghl_location_id', locationId).in('phone', variants);
    return json({ success: true, status: 'success', action: 'restore', locationId, phone });
  }

  // ── remove: marca na lista (dedup por variação) + deleta agora ───────────
  if (kind === 'remove') {
    if (!phone) return errorResponse('Telefone é obrigatório para marcar remoção', 400);
    const { data: existingRows } = await supabase.from('stevo_removal_list')
      .select('id').eq('ghl_location_id', locationId).in('phone', variants).limit(1);
    let rowId = existingRows && existingRows[0]?.id;
    if (rowId) {
      await supabase.from('stevo_removal_list')
        .update({ active: true, name: name || null, reason: reason || null, last_contact_id: contactId || null, updated_at: nowIso })
        .eq('id', rowId);
    } else {
      const { data: ins } = await supabase.from('stevo_removal_list')
        .insert({ client_id: client.id, ghl_location_id: locationId, phone, name: name || null, reason: reason || null, active: true, last_contact_id: contactId || null, updated_at: nowIso })
        .select('id').single();
      rowId = ins?.id;
    }

    let deleted = false, delError: string | undefined;
    if (contactId) {
      if (!client.ghl_api_token) {
        delError = 'GHL API token não configurado para esta location';
      } else {
        const r = await ghlDeleteContact(client.ghl_api_token, contactId);
        deleted = r.ok; delError = r.ok ? undefined : r.error;
        if (r.ok && rowId) {
          const { data: cur } = await supabase.from('stevo_removal_list').select('times_deleted').eq('id', rowId).single();
          await supabase.from('stevo_removal_list')
            .update({ times_deleted: (cur?.times_deleted ?? 0) + 1, last_deleted_at: nowIso, last_contact_id: contactId, updated_at: nowIso })
            .eq('id', rowId);
        }
        await supabase.from('stevo_deletion_log').insert({
          ghl_location_id: locationId, phone, name: name || null, contact_id: contactId,
          trigger: 'dnd', success: r.ok, message: r.ok ? 'OK' : (r.error ?? 'erro'),
        });
      }
    }
    const httpStatus = delError ? 502 : 200;
    return json({
      success: !delError, status: delError ? 'error' : 'success', action: 'remove',
      locationId, phone, listed: true, deleted, ...(delError ? { error: delError } : {}),
    }, httpStatus);
  }

  // ── created: contato entrou; deleta se estiver marcado (qualquer variação) ─
  if (!phone) return json({ success: true, status: 'skipped', reason: 'sem telefone' });
  const { data: marks } = await supabase.from('stevo_removal_list')
    .select('id, active, times_deleted')
    .eq('ghl_location_id', locationId).in('phone', variants).limit(1);
  const mark = marks && marks[0];

  if (!mark || !mark.active) {
    return json({ success: true, status: 'skipped', action: 'created', locationId, phone, listed: false });
  }
  if (!contactId) return json({ success: true, status: 'listed_no_contactid', locationId, phone });
  if (!client.ghl_api_token) {
    await supabase.from('stevo_deletion_log').insert({
      ghl_location_id: locationId, phone, name: name || null, contact_id: contactId,
      trigger: 'contact_created', success: false, message: 'GHL API token não configurado',
    });
    return errorResponse('GHL API token não configurado para esta location', 502);
  }

  const r = await ghlDeleteContact(client.ghl_api_token, contactId);
  if (r.ok) {
    await supabase.from('stevo_removal_list')
      .update({ times_deleted: (mark.times_deleted ?? 0) + 1, last_deleted_at: nowIso, last_contact_id: contactId, updated_at: nowIso })
      .eq('id', mark.id);
  }
  await supabase.from('stevo_deletion_log').insert({
    ghl_location_id: locationId, phone, name: name || null, contact_id: contactId,
    trigger: 'contact_created', success: r.ok, message: r.ok ? 'OK' : (r.error ?? 'erro'),
  });
  return json({
    success: r.ok, status: r.ok ? 'success' : 'error', action: 'created',
    locationId, phone, deleted: r.ok, ...(r.ok ? {} : { error: r.error }),
  }, r.ok ? 200 : 502);
});
