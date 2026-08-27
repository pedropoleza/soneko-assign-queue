import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const cfg: Record<string, string> = {};
let loaded = false;

/** Carrega `wa.app_config` uma vez por isolate. Env vars sempre têm prioridade. */
export async function loadConfig(db: SupabaseClient): Promise<void> {
  if (loaded) return;
  try {
    const { data } = await db.rpc('wa_config');
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data as Record<string, string>)) cfg[k] = v;
    }
  } catch {
    /* segue só com env */
  }
  loaded = true;
}

export function conf(name: string): string | undefined {
  return Deno.env.get(name) || cfg[name] || undefined;
}
