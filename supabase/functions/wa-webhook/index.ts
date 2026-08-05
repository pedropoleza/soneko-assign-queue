// ---------------------------------------------------------------------------
// Spark Talk Link — receptor de webhooks do GoHighLevel.
//
// Eventos que importam:
//   InboundMessage  -> alguém REALMENTE enviou a mensagem. É aqui que o clique
//                      vira conversão e a origem é gravada no CRM.
//   ContactCreate   -> costura o contactId numa conversão que chegou antes do contato.
//   OutboundMessage -> ignorado (só registrado), útil para auditoria.
//   INSTALL/UNINSTALL -> ciclo de vida da instalação.
//
// verify_jwt = false (o GHL não manda JWT do Supabase).
// ---------------------------------------------------------------------------

import { serviceClient } from '../_shared/supabase.ts';
import { conf, loadConfig } from '../_shared/config.ts';
import { json, preflight } from '../_shared/cors.ts';
import { extractCode } from '../_shared/tracking.ts';
import { getAccessToken, writeAttribution } from '../_shared/ghl.ts';

type AnyRec = Record<string, unknown>;

/** O GHL manda data ora como ISO, ora como epoch em ms. */
function toIso(value: string | null): string {
  if (!value) return new Date().toISOString();
  const d = /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function pick(o: AnyRec, ...keys: string[]): string | null {
  for (const k of keys) {
    const parts = k.split('.');
    let cur: unknown = o;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in (cur as AnyRec)) cur = (cur as AnyRec)[p];
      else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === 'string' && cur.trim()) return cur.trim();
    if (typeof cur === 'number') return String(cur);
  }
  return null;
}

/**
 * Assinatura do webhook do Marketplace (header `x-wh-signature`, RSA-SHA256
 * sobre o corpo cru). Só é exigida quando a chave pública está configurada —
 * assim dá para plugar um webhook de Workflow enquanto o app não está publicado.
 */
async function signatureOk(raw: string, sig: string | null, pem: string | undefined): Promise<boolean> {
  if (!pem) return true;
  if (!sig) return false;
  try {
    const body = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'spki',
      der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signature = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(raw));
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const db = serviceClient();
  await loadConfig(db);

  const raw = await req.text();
  let payload: AnyRec;
  try {
    payload = JSON.parse(raw) as AnyRec;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!(await signatureOk(raw, req.headers.get('x-wh-signature'), conf('GHL_WEBHOOK_PUBLIC_KEY')))) {
    return json({ error: 'invalid_signature' }, 401);
  }

  // Webhook de Workflow (fallback) pode mandar um segredo compartilhado.
  const sharedSecret = conf('WA_WEBHOOK_SECRET');
  if (sharedSecret && req.headers.get('x-wa-webhook-secret') !== sharedSecret && !req.headers.get('x-wh-signature')) {
    return json({ error: 'invalid_secret' }, 401);
  }

  const eventType = pick(payload, 'type', 'event_type', 'eventType') ?? 'unknown';
  const locationId = pick(payload, 'locationId', 'location_id', 'location.id', 'companyId');
  if (!locationId) {
    await db.rpc('wa_log_event', {
      p_location_id: null,
      p_event_type: eventType,
      p_payload: payload,
      p_status: 'ignored',
      p_detail: 'missing_location_id',
    });
    return json({ ok: true, ignored: 'missing_location_id' });
  }

  // --- ciclo de vida --------------------------------------------------------
  if (eventType === 'UNINSTALL' || eventType === 'AppUninstall') {
    await db.rpc('wa_mark_uninstalled', { p_location_id: locationId });
    await db.rpc('wa_log_event', {
      p_location_id: locationId, p_event_type: eventType, p_payload: payload,
      p_status: 'received', p_detail: null,
    });
    return json({ ok: true });
  }

  if (eventType === 'INSTALL' || eventType === 'AppInstall') {
    await db.rpc('wa_upsert_install', {
      p_location_id: locationId,
      p_company_id: pick(payload, 'companyId') ?? '',
      p_name: '',
      p_access: '',
      p_refresh: '',
      p_expires_at: null,
      p_scope: '',
    });
    await db.rpc('wa_log_event', {
      p_location_id: locationId, p_event_type: eventType, p_payload: payload,
      p_status: 'received', p_detail: null,
    });
    return json({ ok: true });
  }

  // --- contato criado -------------------------------------------------------
  if (eventType === 'ContactCreate' || eventType === 'ContactUpdate') {
    const contactId = pick(payload, 'id', 'contactId', 'contact_id');
    const phone = pick(payload, 'phone', 'contact.phone');
    const name =
      pick(payload, 'name', 'contact.name') ??
      [pick(payload, 'firstName'), pick(payload, 'lastName')].filter(Boolean).join(' ');
    if (contactId && phone) {
      await db.rpc('wa_link_contact', {
        p_location_id: locationId,
        p_contact_id: contactId,
        p_phone: phone,
        p_name: name || null,
      });
    }
    await db.rpc('wa_log_event', {
      p_location_id: locationId, p_event_type: eventType, p_payload: payload,
      p_status: 'received', p_detail: null,
    });
    return json({ ok: true });
  }

  // --- mensagem recebida: o evento que fecha o funil ------------------------
  if (eventType !== 'InboundMessage' && eventType !== 'inbound_message') {
    await db.rpc('wa_log_event', {
      p_location_id: locationId, p_event_type: eventType, p_payload: payload,
      p_status: 'ignored', p_detail: 'event_not_tracked',
    });
    return json({ ok: true, ignored: eventType });
  }

  const body = pick(payload, 'body', 'message.body', 'messageBody') ?? '';
  const messageId = pick(payload, 'messageId', 'id', 'message.id');
  const conversationId = pick(payload, 'conversationId', 'conversation_id');
  const contactId = pick(payload, 'contactId', 'contact_id');
  const contactName = pick(payload, 'contactName', 'contact.name', 'fullName');
  const contactPhone = pick(payload, 'phone', 'from', 'contact.phone');
  const occurredAt = toIso(pick(payload, 'dateAdded', 'date_added', 'timestamp'));

  const found = extractCode(body);

  const { data: match, error } = await db.rpc('wa_match_inbound', {
    p_location_id: locationId,
    p_message_id: messageId,
    p_conversation_id: conversationId,
    p_contact_id: contactId,
    p_contact_name: contactName,
    p_contact_phone: contactPhone,
    p_body: body,
    p_code: found?.code ?? null,
    p_code_source: found?.source ?? null,
    p_occurred_at: occurredAt,
  });

  const result = (match ?? {}) as AnyRec;
  await db.rpc('wa_log_event', {
    p_location_id: locationId,
    p_event_type: eventType,
    p_payload: payload,
    p_status: error ? 'error' : result.matched ? 'matched' : 'ignored',
    p_detail: error ? error.message : ((result.reason as string) ?? (result.matched_by as string) ?? null),
  });

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!result.matched || result.duplicate) return json({ ok: true, matched: !!result.matched });

  // Gravação no CRM fora do caminho crítico: o GHL só precisa do 200.
  const sync = (async () => {
    if (!contactId) return;
    try {
      const token = await getAccessToken(db, locationId);
      if (!token) throw new Error('no_oauth_token');
      const link = result.link as AnyRec;
      const partner = (result.partner ?? null) as AnyRec | null;
      await writeAttribution(token, locationId, contactId, {
        partnerName: (partner?.name as string) ?? null,
        linkName: (link?.name as string) ?? '',
        code: (link?.code as string) ?? '',
        slug: (link?.slug as string) ?? '',
        matchedBy: (result.matched_by as string) ?? '',
        occurredAt: new Date(occurredAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      });
      await db.rpc('wa_mark_synced', {
        p_conversion_id: result.conversion_id,
        p_ok: true,
        p_error: null,
      });
    } catch (e) {
      await db.rpc('wa_mark_synced', {
        p_conversion_id: result.conversion_id,
        p_ok: false,
        p_error: String(e).slice(0, 400),
      });
    }
  })();

  try {
    // @ts-ignore EdgeRuntime é fornecido pelo runtime do Supabase.
    EdgeRuntime.waitUntil(sync);
  } catch {
    await sync;
  }

  return json({
    ok: true,
    matched: true,
    matched_by: result.matched_by,
    conversion_id: result.conversion_id,
  });
});
