// stevo-setup — API JSON do fluxo de onboarding por link único (token).
// A tela fica no app (soneko-assign-queue: /?page=stevo-setup&token=...);
// o domínio compartilhado *.supabase.co não serve HTML (reescreve para
// text/plain), então esta função expõe apenas JSON.
//
// POST { token, action: 'load' | 'test' | 'save', ... }
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const STEVO_TIMEOUT_MS = 12000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

interface TokenContext {
  clientId: string;
  clientName: string;
  ghlLocationId: string;
  webhookSecret: string;
}

/** Valida o token de setup e retorna o cliente associado (ou null). */
async function resolveToken(token: string): Promise<TokenContext | null> {
  if (!token) return null;
  const { data } = await supabase
    .from('stevo_setup_tokens')
    .select('client_id, expires_at, stevo_clients ( id, client_name, ghl_location_id, webhook_secret )')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  const client = data.stevo_clients as unknown as {
    id: string;
    client_name: string;
    ghl_location_id: string;
    webhook_secret: string;
  } | null;
  if (!client) return null;
  return {
    clientId: client.id,
    clientName: client.client_name,
    ghlLocationId: client.ghl_location_id,
    webhookSecret: client.webhook_secret,
  };
}

function maskKey(key: string): string {
  return key.length <= 4 ? '••••' : `••••••••${key.slice(-4)}`;
}

async function testStevoConnection(serverUrl: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  if (!/^https:\/\/.+/.test(serverUrl)) {
    return { ok: false, message: 'URL do servidor deve começar com https://' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STEVO_TIMEOUT_MS);
  try {
    // GET /user/blocklist é inócuo e valida servidor + apikey de uma vez
    const response = await fetch(`${serverUrl.replace(/\/+$/, '')}/user/blocklist`, {
      method: 'GET',
      headers: { apikey: apiKey },
      signal: controller.signal,
    });
    if (response.ok) return { ok: true, message: 'Conexão OK — servidor e API Key válidos' };
    if (response.status === 401) return { ok: false, message: 'API Key inválida (401 not authorized)' };
    return { ok: false, message: `Servidor respondeu HTTP ${response.status}` };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return { ok: false, message: isTimeout ? 'Timeout ao conectar no servidor' : 'Falha de rede — confira a URL do servidor' };
  } finally {
    clearTimeout(timeout);
  }
}

interface IncomingInstance {
  id?: string;
  name?: string;
  serverUrl?: string;
  apiKey?: string;
  active?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method === 'GET') {
    return json({ service: 'stevo-setup', hint: 'Abra o link de setup no app (/?page=stevo-setup&token=...)' });
  }
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const ctx = await resolveToken(typeof body.token === 'string' ? body.token : '');
  if (!ctx) return json({ error: 'Link inválido ou expirado — peça um novo ao administrador' }, 401);

  const action = body.action;

  if (action === 'load') {
    const { data: instances } = await supabase
      .from('stevo_instances')
      .select('id, name, server_url, api_key, active')
      .eq('client_id', ctx.clientId)
      .order('created_at', { ascending: true });
    return json({
      clientName: ctx.clientName,
      locationId: ctx.ghlLocationId,
      instances: (instances ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        serverUrl: i.server_url,
        maskedKey: maskKey(i.api_key),
        active: i.active,
      })),
    });
  }

  if (action === 'test') {
    const serverUrl = typeof body.serverUrl === 'string' ? body.serverUrl.trim() : '';
    let apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    // Instância existente com key em branco -> testa com a key salva
    if (!apiKey && typeof body.instanceId === 'string') {
      const { data: existing } = await supabase
        .from('stevo_instances')
        .select('api_key')
        .eq('id', body.instanceId)
        .eq('client_id', ctx.clientId)
        .maybeSingle();
      apiKey = existing?.api_key ?? '';
    }
    if (!serverUrl || !apiKey) return json({ ok: false, message: 'Informe a URL do servidor e a API Key' });
    return json(await testStevoConnection(serverUrl, apiKey));
  }

  if (action === 'save') {
    const incoming = Array.isArray(body.instances) ? (body.instances as IncomingInstance[]) : [];
    if (incoming.length === 0) return json({ error: 'Adicione pelo menos uma instância' }, 400);

    const { data: current } = await supabase
      .from('stevo_instances')
      .select('id, api_key')
      .eq('client_id', ctx.clientId);
    const currentById = new Map((current ?? []).map((i) => [i.id, i]));

    // Valida tudo antes de gravar qualquer coisa
    for (const inst of incoming) {
      const name = (inst.name ?? '').trim();
      const serverUrl = (inst.serverUrl ?? '').trim();
      const apiKey = (inst.apiKey ?? '').trim();
      const isExisting = inst.id && currentById.has(inst.id);
      if (!name) return json({ error: 'Toda instância precisa de um nome' }, 400);
      if (!/^https:\/\/.+/.test(serverUrl)) {
        return json({ error: `Instância "${name}": URL do servidor deve começar com https://` }, 400);
      }
      if (!apiKey && !isExisting) {
        return json({ error: `Instância "${name}": API Key é obrigatória` }, 400);
      }
    }

    const keepIds: string[] = [];
    for (const inst of incoming) {
      const name = (inst.name ?? '').trim();
      const serverUrl = (inst.serverUrl ?? '').trim();
      const apiKey = (inst.apiKey ?? '').trim();
      const active = inst.active !== false;
      const existing = inst.id ? currentById.get(inst.id) : undefined;

      if (existing) {
        const { error } = await supabase
          .from('stevo_instances')
          .update({
            name,
            server_url: serverUrl,
            // Key em branco = mantém a atual
            ...(apiKey ? { api_key: apiKey } : {}),
            active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('client_id', ctx.clientId);
        if (error) return json({ error: 'Erro ao atualizar instância' }, 500);
        keepIds.push(existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from('stevo_instances')
          .insert({ client_id: ctx.clientId, name, server_url: serverUrl, api_key: apiKey, active })
          .select('id')
          .single();
        if (error || !inserted) return json({ error: 'Erro ao criar instância' }, 500);
        keepIds.push(inserted.id);
      }
    }

    // Remove instâncias que saíram do formulário
    const removeIds = (current ?? []).map((i) => i.id).filter((id) => !keepIds.includes(id));
    if (removeIds.length > 0) {
      await supabase.from('stevo_instances').delete().in('id', removeIds).eq('client_id', ctx.clientId);
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stevo-dnd`;
    return json({
      saved: true,
      ghlConfig: {
        webhookUrl,
        secretHeader: 'x-webhook-secret',
        secretValue: ctx.webhookSecret,
        locationId: ctx.ghlLocationId,
        blockBody: {
          action: 'block',
          locationId: '{{location.id}}',
          contactId: '{{contact.id}}',
          phone: '{{contact.phone}}',
          email: '{{contact.email}}',
          source: 'ghl_workflow',
          reason: 'DND WhatsApp habilitado',
        },
        unblockBody: {
          action: 'unblock',
          locationId: '{{location.id}}',
          contactId: '{{contact.id}}',
          phone: '{{contact.phone}}',
          source: 'ghl_workflow',
          reason: 'DND WhatsApp removido',
        },
      },
    });
  }

  return json({ error: 'Ação desconhecida' }, 400);
});
