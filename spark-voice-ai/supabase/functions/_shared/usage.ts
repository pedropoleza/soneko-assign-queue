// Contagem de uso e gate de limite mensal (Etapa 3 / D3).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type MonthUsage = { audios: number; characters: number };

export async function currentMonthUsage(db: SupabaseClient, accountId: string): Promise<MonthUsage> {
  const { data, error } = await db.rpc('current_month_usage', { p_account_id: accountId });
  if (error) throw new Error(`usage_rpc:${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { audios: row?.audios ?? 0, characters: row?.characters ?? 0 };
}

export type LimitCheck = { ok: boolean; reason?: 'audio_limit' | 'character_limit' };

/** Verifica se cabe mais uma geração com `nextChars` caracteres. */
export function withinLimits(
  usage: MonthUsage,
  audioLimit: number,
  charLimit: number,
  nextChars: number,
): LimitCheck {
  if (usage.audios >= audioLimit) return { ok: false, reason: 'audio_limit' };
  if (usage.characters + nextChars > charLimit) return { ok: false, reason: 'character_limit' };
  return { ok: true };
}
