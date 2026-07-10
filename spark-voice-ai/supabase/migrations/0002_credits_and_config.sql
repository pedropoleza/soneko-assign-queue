-- ============================================================================
-- Spark Voice AI — créditos pré-pagos (pay-per-use, sem planos) + config runtime
-- Substitui a lógica de planos/limites mensais por saldo de crédito por conta.
-- ============================================================================

-- Saldo de crédito por conta (os campos monthly_* de 0001 ficam sem uso).
alter table spark.accounts add column if not exists credit_balance numeric(12,4) not null default 0;

-- Extrato de crédito: recargas (+) e consumos (-)
create table if not exists spark.credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references spark.accounts(id) on delete cascade,
  kind          text not null check (kind in ('topup','debit','adjustment')),
  amount        numeric(12,4) not null,          -- + entra crédito, - consome
  balance_after numeric(12,4) not null,
  generation_id uuid references spark.audio_generations(id) on delete set null,
  description   text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_credit_tx_account_created
  on spark.credit_transactions(account_id, created_at desc);
alter table spark.credit_transactions enable row level security;

-- Débito/recarga atômico (amount negativo = débito). Só service_role executa.
create or replace function spark.apply_credit(p_account uuid, p_amount numeric, p_kind text, p_desc text, p_gen uuid)
returns numeric language plpgsql security definer set search_path = spark as $$
declare newbal numeric;
begin
  update spark.accounts set credit_balance = credit_balance + p_amount
    where id = p_account returning credit_balance into newbal;
  insert into spark.credit_transactions(account_id, kind, amount, balance_after, generation_id, description)
    values (p_account, p_kind, p_amount, newbal, p_gen, p_desc);
  return newbal;
end;$$;
revoke all on function spark.apply_credit(uuid,numeric,text,text,uuid) from public, anon, authenticated;
grant execute on function spark.apply_credit(uuid,numeric,text,text,uuid) to service_role;

-- Config/segredos runtime das Edge Functions (chaves ficam no banco, não em git).
-- RLS deny-all; só service_role lê (via config.ts nas funções).
create table if not exists spark.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table spark.app_config enable row level security;

-- Chaves esperadas em app_config (valores setados fora do versionamento):
--   ELEVENLABS_API_KEY, GHL_CLIENT_ID, GHL_CLIENT_SECRET, GHL_WEBHOOK_SECRET,
--   GHL_OAUTH_REDIRECT_URI, SPARK_SESSION_SECRET, STORAGE_BUCKET_NAME,
--   SPARK_PRICE_MARKUP, APP_URL. (SUPABASE_URL/SERVICE_ROLE são automáticos.)
