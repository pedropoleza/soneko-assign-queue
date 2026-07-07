// stevo-dnd — webhook GHL -> Stevo (block/unblock de contato no WhatsApp)
// Deploy: Supabase Edge Function (verify_jwt = false; auth própria por
// x-webhook-secret POR CLIENTE, armazenado em stevo_clients.webhook_secret).
//
// API Stevo validada no OpenAPI oficial (https://smv2-N.stevo.chat/swagger/doc.json):
//   POST {serverUrl}/user/block|/user/unblock  header apikey  body {"number":"..."}
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const STEVO_TIMEOUT_MS = 15000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return json({ success: false, status: 'error', message }, status);
}

/** Comparação em tempo constante para o webhook secret. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

/** "+55 (38) 99999-9999" -> "5538999999999". Lança Error com mensagem clara. */
function normalizePhone(rawPhone: unknown): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Telefone ausente no payload');
  }
  let digits = rawPhone.replace(/\D+/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 10) {
    throw new Error(`Telefone inválido: "${rawPhone}" tem menos dígitos que o mínimo esperado (DDD + número)`);
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length > 15) {
    throw new Error(`Telefone inválido: "${rawPhone}" excede o tamanho máximo E.164`);
  }
  return digits;
}

interface InstanceRow {
  id: string;
  name: string;
  server_url: string;
  api_key: string;
  active: boolean;
}

interface StevoResult {
  success: boolean;
  error?: string;
}

/** Chamada genérica à API do Stevo, com timeout e erro normalizado (sem vazar apiKey). */
async function stevoFetch(
  instance: InstanceRow,
  path: string,
  bodyObj: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STEVO_TIMEOUT_MS);
  try {
    const response = await fetch(`${instance.server_url.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: instance.api_key },
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const apiMessage =
        data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
          ? String((data as Record<string, unknown>).error)
          : `HTTP ${response.status}`;
      const safe = apiMessage.split(instance.api_key).join('[REDACTED]').slice(0, 300);
      return { ok: false, status: response.status, data, error: safe };
    }
    return { ok: true, status: response.status, data };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      error: isTimeout
        ? `Timeout após ${STEVO_TIMEOUT_MS}ms ao chamar a instância Stevo`
        : 'Falha de rede ao chamar a instância Stevo',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve o número no WhatsApp via /user/check. Retorna o LID (identificador
 * interno do WhatsApp, aceito pelo block/unblock), o JID por telefone e se o
 * número existe. Trata o 9º dígito brasileiro. Se a checagem falhar, devolve {}.
 */
async function resolveWhatsappJid(
  instance: InstanceRow,
  phone: string
): Promise<{ lid?: string; jid?: string; onWhatsapp?: boolean }> {
  const res = await stevoFetch(instance, '/user/check', { number: [phone], formatJid: true });
  if (!res.ok || !res.data || typeof res.data !== 'object') return {};
  const users = (res.data as { data?: { Users?: Array<{ IsInWhatsapp?: boolean; JID?: string; LID?: string }> } })?.data?.Users;
  const u = Array.isArray(users) ? users[0] : undefined;
  if (!u) return {};
  return { lid: u.LID, jid: u.JID, onWhatsapp: u.IsInWhatsapp };
}

async function stevoBlockCall(
  instance: InstanceRow,
  action: 'block' | 'unblock',
  phone: string
): Promise<StevoResult> {
  // Resolve para o identificador aceito pelo Stevo. O LID (@lid) é o que a API
  // aceita de forma confiável; caímos para JID/telefone se o LID não vier.
  const resolved = await resolveWhatsappJid(instance, phone);
  if (resolved.onWhatsapp === false) {
    return { success: false, error: `Número ${phone} não está no WhatsApp` };
  }
  const number = resolved.lid ?? resolved.jid ?? phone;
  const res = await stevoFetch(instance, `/user/${action}`, { number });
  return res.ok ? { success: true } : { success: false, error: res.error ?? 'Erro desconhecido na instância' };
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return json({ status: 'ok', service: 'stevo-dnd-middleware' });
  }
  if (req.method !== 'POST') {
    return errorResponse('Método não permitido', 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Body JSON inválido', 400);
  }

  // Validação do payload.
  // Tolerante ao GHL Custom Data: os campos podem vir no topo do JSON ou
  // aninhados em customData; e valores costumam chegar com aspas literais
  // (ex.: '"block"'). Removemos aspas/espaços, normalizamos a caixa e
  // aceitamos por conteúdo (contém "block"/"unblock").
  const cd =
    body.customData && typeof body.customData === 'object'
      ? (body.customData as Record<string, unknown>)
      : {};
  const pick = (k: string): unknown => (body[k] !== undefined ? body[k] : cd[k]);
  const clean = (v: unknown): string =>
    typeof v === 'string'
      ? v.trim().replace(/^["']+|["']+$/g, '').trim()
      : v === undefined || v === null
        ? ''
        : String(v).trim();

  const rawAction = pick('action');
  const a = clean(rawAction).toLowerCase();
  const action = a.includes('unblock') ? 'unblock' : a.includes('block') ? 'block' : '';
  if (!action) {
    return errorResponse(
      `Payload inválido — action deve ser "block" ou "unblock" (recebido: ${JSON.stringify(rawAction)}; campos no topo: ${Object.keys(body).join(', ') || 'nenhum'})`,
      400
    );
  }
  const locationId = clean(pick('locationId'));
  const contactId = clean(pick('contactId'));
  if (!locationId) return errorResponse('Payload inválido — locationId é obrigatório', 400);
  if (!contactId) return errorResponse('Payload inválido — contactId é obrigatório', 400);
  const source = clean(pick('source')) || 'unknown';
  const reason = clean(pick('reason'));

  // Resolve o cliente pela location
  const { data: client, error: clientError } = await supabase
    .from('stevo_clients')
    .select('id, client_name, webhook_secret, block_on_all_instances, active')
    .eq('ghl_location_id', locationId)
    .maybeSingle();

  if (clientError) return errorResponse('Erro interno ao consultar configuração', 500);
  if (!client || !client.active) {
    return errorResponse(`Location "${locationId}" não está configurada neste middleware`, 404);
  }

  // Autenticação: secret por cliente. Aceita via header x-webhook-secret
  // (recomendado) OU via campo do body (webhookSecret/secret/x-webhook-secret),
  // pois a configuração de headers no GHL às vezes é limitada.
  const providedSecret =
    (req.headers.get('x-webhook-secret') ?? '') ||
    clean(pick('webhookSecret')) ||
    clean(pick('secret')) ||
    clean(pick('x-webhook-secret'));
  if (!providedSecret || !safeEqual(providedSecret, client.webhook_secret)) {
    return errorResponse('Segredo do webhook ausente ou inválido', 401);
  }

  // Telefone
  let phone: string;
  try {
    phone = normalizePhone(clean(pick('phone')));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Telefone inválido', 400);
  }

  // Instâncias ativas
  const { data: instances, error: instError } = await supabase
    .from('stevo_instances')
    .select('id, name, server_url, api_key, active')
    .eq('client_id', client.id)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (instError) return errorResponse('Erro interno ao consultar instâncias', 500);
  if (!instances || instances.length === 0) {
    return errorResponse(`Location "${locationId}" não possui nenhuma instância Stevo ativa`, 422);
  }

  const targets: InstanceRow[] = client.block_on_all_instances ? instances : [instances[0]];

  const results = await Promise.all(
    targets.map(async (instance) => {
      const result = await stevoBlockCall(instance, action as 'block' | 'unblock', phone);
      return { instanceId: instance.id, instance: instance.name, ...result };
    })
  );

  // Auditoria (uma linha por instância processada)
  const auditRows = results.map((r) => ({
    action,
    ghl_location_id: locationId,
    contact_id: contactId,
    phone,
    instance_name: r.instance,
    success: r.success,
    message: r.success ? 'OK' : r.error ?? 'erro desconhecido',
    source,
    reason,
  }));
  const { error: auditError } = await supabase.from('stevo_audit_log').insert(auditRows);
  if (auditError) console.error('Falha ao gravar auditoria:', auditError.message);

  // Fila de retry: enfileira falhas transitórias; resolve pendência ao ter sucesso.
  const nowIso = new Date().toISOString();
  for (const r of results) {
    if (r.success) {
      await supabase
        .from('stevo_pending_ops')
        .update({ status: 'done', resolved_at: nowIso, updated_at: nowIso })
        .eq('instance_id', r.instanceId)
        .eq('phone', phone)
        .eq('action', action)
        .eq('status', 'pending');
      continue;
    }
    // Não enfileira falha permanente (número não existe no WhatsApp).
    if ((r.error ?? '').includes('não está no WhatsApp')) continue;
    const row = {
      client_id: client.id,
      ghl_location_id: locationId,
      instance_id: r.instanceId,
      instance_name: r.instance,
      action,
      phone,
      contact_id: contactId,
      source,
      reason,
      status: 'pending' as const,
      attempts: 0,
      last_error: r.error ?? 'erro desconhecido',
      next_attempt_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      updated_at: nowIso,
    };
    const { error: insErr } = await supabase.from('stevo_pending_ops').insert(row);
    if (insErr && insErr.code === '23505') {
      // Já havia pendência para (instância, telefone, ação): atualiza o erro.
      await supabase
        .from('stevo_pending_ops')
        .update({ last_error: r.error ?? 'erro desconhecido', updated_at: nowIso })
        .eq('instance_id', r.instanceId)
        .eq('phone', phone)
        .eq('action', action)
        .eq('status', 'pending');
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const status = succeeded === results.length ? 'success' : succeeded > 0 ? 'partial_success' : 'error';
  const httpStatus = status === 'success' ? 200 : status === 'partial_success' ? 207 : 502;

  return json(
    {
      success: status === 'success',
      status,
      action,
      locationId,
      contactId,
      phone,
      results: results.map((r) => ({
        instance: r.instance,
        success: r.success,
        ...(r.success ? {} : { error: r.error }),
      })),
    },
    httpStatus
  );
});
