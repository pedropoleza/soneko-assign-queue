-- ============================================================================
-- Spark Voice AI — V1 initial schema
-- Multi-tenant, isolado por account_id. Uma account = uma location do GHL.
-- Provider genérico ('elevenlabs') deixa espaço para futuros TTS.
-- Convenção da casa: schema dedicado (`spark`), acesso via Edge Functions com
-- service role. RLS habilitada como deny-all (service role faz bypass); nenhum
-- acesso anônimo direto às tabelas.
-- ============================================================================

create schema if not exists spark;

-- updated_at automático -------------------------------------------------------
create or replace function spark.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) accounts (raiz — não tem account_id) ------------------------------------
create table if not exists spark.accounts (
  id                      uuid primary key default gen_random_uuid(),
  ghl_location_id         text unique not null,
  ghl_company_id          text,
  company_name            text not null,
  plan                    text not null default 'starter',
  monthly_audio_limit     int  not null default 100,
  monthly_character_limit int  not null default 20000,
  status                  text not null default 'active'
                            check (status in ('active','suspended','cancelled')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger trg_accounts_updated before update on spark.accounts
  for each row execute function spark.touch_updated_at();

-- 2) oauth_tokens (D1 = App GHL com OAuth) -----------------------------------
-- Tokens do GHL por account. Necessário para instalar/renovar acesso e resolver
-- account_id na sessão do painel. secret nunca em claro (tokens são sensíveis).
create table if not exists spark.oauth_tokens (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references spark.accounts(id) on delete cascade,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  scope          text,
  token_type     text not null default 'Bearer',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists idx_oauth_tokens_account on spark.oauth_tokens(account_id);
create trigger trg_oauth_tokens_updated before update on spark.oauth_tokens
  for each row execute function spark.touch_updated_at();

-- 3) voices ------------------------------------------------------------------
create table if not exists spark.voices (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references spark.accounts(id) on delete cascade,
  provider            text not null default 'elevenlabs',
  provider_voice_id   text not null,            -- voice_id retornado pela ElevenLabs
  voice_name          text not null,
  language            text not null,
  status              text not null default 'active'
                        check (status in ('active','inactive')),
  -- consentimento (obrigatório — seção 2.3)
  consent_accepted    boolean not null default false,
  consent_accepted_at timestamptz,
  consent_ip          text,
  consent_user_agent  text,
  voice_owner_name    text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_voices_account on spark.voices(account_id);
-- no máximo uma voz ativa por conta
create unique index if not exists idx_voices_one_active
  on spark.voices(account_id) where status = 'active';
create trigger trg_voices_updated before update on spark.voices
  for each row execute function spark.touch_updated_at();

-- 4) audio_templates ---------------------------------------------------------
create table if not exists spark.audio_templates (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references spark.accounts(id) on delete cascade,
  name          text not null,
  event_type    text not null,            -- birthday, new_lead, reminder...
  language      text not null,
  tone          text,
  template_text text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_templates_account on spark.audio_templates(account_id);
create trigger trg_templates_updated before update on spark.audio_templates
  for each row execute function spark.touch_updated_at();

-- 5) audio_generations -------------------------------------------------------
create table if not exists spark.audio_generations (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references spark.accounts(id) on delete cascade,
  contact_id      text,                    -- id do contato no GHL
  template_id     uuid references spark.audio_templates(id) on delete set null,
  voice_id        uuid references spark.voices(id) on delete set null,
  event_type      text,
  contact_name    text,
  contact_phone   text,
  final_text      text not null,
  audio_url       text,
  storage_path    text,                    -- caminho no bucket privado (D6)
  provider        text not null default 'elevenlabs',
  characters_used int,
  estimated_cost  numeric(10,4),
  status          text not null
                    check (status in ('processing','completed','failed')),
  error_message   text,
  is_test         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_generations_account_created
  on spark.audio_generations(account_id, created_at desc);
create index if not exists idx_generations_status on spark.audio_generations(account_id, status);

-- 6) usage_logs --------------------------------------------------------------
create table if not exists spark.usage_logs (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references spark.accounts(id) on delete cascade,
  generation_id   uuid references spark.audio_generations(id) on delete cascade,
  characters_used int not null,
  audio_seconds   numeric(10,2),
  provider        text not null default 'elevenlabs',
  event_type      text,
  created_at      timestamptz not null default now()
);
-- consultas de uso mensal batem nessa combinação o tempo todo
create index if not exists idx_usage_account_created
  on spark.usage_logs(account_id, created_at desc);

-- 7) webhook_secrets ---------------------------------------------------------
-- Secret por location para autenticar o webhook do workflow do GHL.
-- Guardamos apenas o hash; o valor em claro só existe no momento da geração.
create table if not exists spark.webhook_secrets (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references spark.accounts(id) on delete cascade,
  secret_hash  text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists idx_webhook_secrets_account on spark.webhook_secrets(account_id);
create unique index if not exists idx_webhook_secrets_one_active
  on spark.webhook_secrets(account_id) where active = true;

-- RLS: deny-all. Todo acesso passa pelas Edge Functions (service role bypassa).
alter table spark.accounts          enable row level security;
alter table spark.oauth_tokens      enable row level security;
alter table spark.voices            enable row level security;
alter table spark.audio_templates   enable row level security;
alter table spark.audio_generations enable row level security;
alter table spark.usage_logs        enable row level security;
alter table spark.webhook_secrets   enable row level security;

-- Uso mensal corrente por conta (áudios + caracteres) — usado no gate de limite.
create or replace function spark.current_month_usage(p_account_id uuid)
returns table (audios int, characters int)
language sql stable as $$
  select
    count(*)::int                                as audios,
    coalesce(sum(g.characters_used), 0)::int     as characters
  from spark.audio_generations g
  where g.account_id = p_account_id
    and g.status = 'completed'
    and g.created_at >= date_trunc('month', now());
$$;
