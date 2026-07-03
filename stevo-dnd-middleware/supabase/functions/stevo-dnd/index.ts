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

async function stevoBlockCall(
  instance: InstanceRow,
  action: 'block' | 'unblock',
  phone: string
): Promise<StevoResult> {
  const url = `${instance.server_url.replace(/\/+$/, '')}/user/${action}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STEVO_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: instance.api_key },
      body: JSON.stringify({ number: phone }),
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
      // Nunca repassar a apiKey em mensagens de erro
      const safe = apiMessage.split(instance.api_key).join('[REDACTED]').slice(0, 300);
      return { success: false, error: safe };
    }
    return { success: true };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      success: false,
      error: isTimeout
        ? `Timeout após ${STEVO_TIMEOUT_MS}ms ao chamar a instância Stevo`
        : 'Falha de rede ao chamar a instância Stevo',
    };
  } finally {
    clearTimeout(timeout);
  }
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

  // Validação do payload
  const action = body.action;
  if (action !== 'block' && action !== 'unblock') {
    return errorResponse('Payload inválido — action deve ser "block" ou "unblock"', 400);
  }
  const locationId = typeof body.locationId === 'string' ? body.locationId.trim() : '';
  const contactId = typeof body.contactId === 'string' ? body.contactId.trim() : '';
  if (!locationId) return errorResponse('Payload inválido — locationId é obrigatório', 400);
  if (!contactId) return errorResponse('Payload inválido — contactId é obrigatório', 400);
  const source = typeof body.source === 'string' ? body.source : 'unknown';
  const reason = typeof body.reason === 'string' ? body.reason : '';

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

  // Autenticação: secret por cliente
  const providedSecret = req.headers.get('x-webhook-secret') ?? '';
  if (!providedSecret || !safeEqual(providedSecret, client.webhook_secret)) {
    return errorResponse('Segredo do webhook ausente ou inválido', 401);
  }

  // Telefone
  let phone: string;
  try {
    phone = normalizePhone(body.phone);
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
      const result = await stevoBlockCall(instance, action, phone);
      return { instance: instance.name, ...result };
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
