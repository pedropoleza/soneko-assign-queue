import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/config";

/**
 * Service-role Supabase client — SERVER ONLY.
 * Reaches the isolated `spark_saude` schema exclusively through SECURITY DEFINER
 * RPCs in `public` (spark_saude_*), which are granted to service_role only.
 * Returns null when Supabase isn't configured (the token store then falls back
 * to env — see lib/ghl/auth.ts).
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceKey) return null;
  if (!cached) {
    cached = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
