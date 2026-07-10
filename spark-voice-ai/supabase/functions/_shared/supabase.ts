// Cliente Supabase com service role — usado dentro das Edge Functions.
// Service role bypassa a RLS deny-all; o isolamento por account_id é garantido
// aqui, filtrando toda query por account_id resolvido da sessão/location.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('supabase_env_missing');
  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'spark' },
  });
}
