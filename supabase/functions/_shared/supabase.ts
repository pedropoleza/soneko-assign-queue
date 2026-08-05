import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Todas as tabelas vivem no schema `wa`, que NÃO é exposto pelo PostgREST.
// O acesso acontece só através das RPCs `public.wa_*` (SECURITY DEFINER),
// executadas com a service role.
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('supabase_env_missing');
  return createClient(url, key, { auth: { persistSession: false } });
}
