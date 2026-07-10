// Carrega config/segredos da tabela spark.app_config em runtime (uma vez por
// instância) e disponibiliza via conf(). Assim as chaves ficam no banco (RLS
// deny-all; só service_role lê) em vez de env da plataforma. conf() ainda
// prioriza a env real, se existir.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const cfg: Record<string, string> = {};
let loaded = false;

export async function loadConfig(db: SupabaseClient): Promise<void> {
  if (loaded) return;
  try {
    const { data } = await db.from('app_config').select('key,value');
    if (data) for (const r of data as Array<{ key: string; value: string }>) cfg[r.key] = r.value;
  } catch {
    /* mantém o que houver em env */
  }
  loaded = true;
}

export function conf(name: string): string | undefined {
  return Deno.env.get(name) ?? cfg[name];
}
