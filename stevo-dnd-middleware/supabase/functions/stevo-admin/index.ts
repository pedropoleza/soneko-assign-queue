// stevo-admin — API JSON do painel do administrador.
// A tela fica no app (soneko-assign-queue: /?page=stevo); o domínio
// compartilhado *.supabase.co não serve HTML, então esta função expõe
// apenas JSON. Protegida por admin secret (hash SHA-256 em
// stevo_settings.admin_secret_hash).
//
// POST { secret, action: 'list' | 'create' | 'setupLink' | 'toggleClient' | 'audit', ... }
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SETUP_TOKEN_TTL_DAYS = 7;

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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function isAdmin(secret: unknown): Promise<boolean> {
  if (typeof secret !== 'string' || !secret) return false;
  const { data } = await supabase
    .from('stevo_settings')
    .select('value')
    .eq('key', 'admin_secret_hash')
    .maybeSingle();
  if (!data) return false;
  return (await sha256Hex(secret)) === data.value;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createSetupToken(clientId: string): Promise<string> {
  const token = randomHex(24);
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('stevo_setup_tokens')
    .insert({ token, client_id: clientId, expires_at: expiresAt });
  if (error) throw new Error('Erro ao gerar token de setup');
  return token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method === 'GET') {
    return json({ service: 'stevo-admin', hint: 'Abra o painel no app (/?page=stevo)' });
  }
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  if (!(await isAdmin(body.secret))) {
    return json({ error: 'Admin secret inválido' }, 401);
  }

  const action = body.action;

  if (action === 'list') {
    const { data: clients, error } = await supabase
      .from('stevo_clients')
      .select('id, client_name, ghl_location_id, block_on_all_instances, active, created_at, stevo_instances ( id, name, active )')
      .order('created_at', { ascending: true });
    if (error) return json({ error: 'Erro ao listar clientes' }, 500);
    return json({
      clients: (clients ?? []).map((c) => ({
        id: c.id,
        clientName: c.client_name,
        locationId: c.ghl_location_id,
        active: c.active,
        blockOnAllInstances: c.block_on_all_instances,
        instances: (c.stevo_instances as { id: string; name: string; active: boolean }[]).map((i) => ({
          name: i.name,
          active: i.active,
        })),
      })),
    });
  }

  if (action === 'create') {
    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    const ghlLocationId = typeof body.ghlLocationId === 'string' ? body.ghlLocationId.trim() : '';
    if (!clientName || !ghlLocationId) {
      return json({ error: 'Informe o nome do cliente e o Location ID do GHL' }, 400);
    }
    const { data: created, error } = await supabase
      .from('stevo_clients')
      .insert({
        client_name: clientName,
        ghl_location_id: ghlLocationId,
        webhook_secret: randomHex(24),
      })
      .select('id')
      .single();
    if (error) {
      const duplicated = error.code === '23505';
      return json({ error: duplicated ? 'Já existe um cliente com esse Location ID' : 'Erro ao criar cliente' }, 400);
    }
    const token = await createSetupToken(created.id);
    return json({ created: true, clientId: created.id, setupToken: token, expiresInDays: SETUP_TOKEN_TTL_DAYS });
  }

  if (action === 'setupLink') {
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const { data: client } = await supabase
      .from('stevo_clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();
    if (!client) return json({ error: 'Cliente não encontrado' }, 404);
    const token = await createSetupToken(client.id);
    return json({ setupToken: token, expiresInDays: SETUP_TOKEN_TTL_DAYS });
  }

  if (action === 'toggleClient') {
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const active = body.active === true;
    const { error } = await supabase
      .from('stevo_clients')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', clientId);
    if (error) return json({ error: 'Erro ao atualizar cliente' }, 500);
    return json({ updated: true });
  }

  if (action === 'audit') {
    const locationId = typeof body.locationId === 'string' && body.locationId ? body.locationId : null;
    let query = supabase
      .from('stevo_audit_log')
      .select('created_at, action, ghl_location_id, contact_id, phone, instance_name, success, message, source, reason')
      .order('created_at', { ascending: false })
      .limit(50);
    if (locationId) query = query.eq('ghl_location_id', locationId);
    const { data, error } = await query;
    if (error) return json({ error: 'Erro ao consultar auditoria' }, 500);
    return json({ entries: data ?? [] });
  }

  return json({ error: 'Ação desconhecida' }, 400);
});
