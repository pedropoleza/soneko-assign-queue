// Créditos pré-pagos por conta (modelo pay-per-use, sem planos/limites).
// Cada geração custa `price` (custo estimado × markup) e é debitada do saldo.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { conf } from './config.ts';
import { estimateCost } from './elevenlabs.ts';

/** Preço cobrado do cliente por uma geração de N caracteres. */
export function priceFor(characters: number): number {
  const markup = Number(conf('SPARK_PRICE_MARKUP') ?? '1') || 1;
  return Number((estimateCost(characters) * markup).toFixed(4));
}

export async function getBalance(db: SupabaseClient, accountId: string): Promise<number> {
  const { data } = await db.from('accounts').select('credit_balance').eq('id', accountId).single();
  return Number(data?.credit_balance ?? 0);
}

/** Aplica um lançamento de crédito (amount negativo = débito) e retorna o novo saldo. */
export async function applyCredit(
  db: SupabaseClient,
  accountId: string,
  amount: number,
  kind: 'topup' | 'debit' | 'adjustment',
  description: string,
  generationId: string | null,
): Promise<number> {
  const { data, error } = await db.rpc('apply_credit', {
    p_account: accountId,
    p_amount: amount,
    p_kind: kind,
    p_desc: description,
    p_gen: generationId,
  });
  if (error) throw new Error(`credit:${error.message}`);
  return Number(data);
}
