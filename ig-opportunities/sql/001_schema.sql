-- IG Opportunities — cria oportunidade no GHL após a 1ª interação de Instagram.
--
-- Contexto: a Sócios aborda novos seguidores no Instagram (via ManyChat OU direto
-- no Direct). O GHL já sincroniza essas conversas (canal Instagram). Este módulo
-- lê as conversas de Instagram e cria uma oportunidade (Pré venda / Instagram)
-- para cada seguidor que ainda não tem — uma vez por seguidor, para sempre.
--
-- App independente: schema próprio `igopps`, function e cron próprios. Não toca
-- em nenhum outro schema (soneko, smarttags, spark, wa, qr…).

create schema if not exists igopps;

-- Config de admin (secret usado pelo cron e pela API administrativa)
create table if not exists igopps.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- Uma linha por subaccount (Sócios é a primeira)
create table if not exists igopps.accounts (
  id               uuid primary key default gen_random_uuid(),
  ghl_location_id  text not null unique,
  name             text,
  -- Private Integration Token da subaccount; só acessível via service_role.
  pit_token        text not null,

  -- Destino da oportunidade criada.
  pipeline_id      text not null,
  stage_id         text not null,
  opportunity_source text not null default 'instagram',
  -- Template do nome da oportunidade. {name} = nome do contato/@handle.
  name_template    text not null default '{name}',

  -- Regras.
  -- Cria mesmo sem resposta do seguidor (toda abordagem). Se true, exige >=1
  -- mensagem inbound antes de criar.
  require_inbound  boolean not null default false,
  -- Ignora conversas anteriores a esta data (evita backfill dos antigos).
  only_after       timestamptz not null default now(),

  -- Cursor incremental: maior lastMessageDate (epoch ms) já processado.
  cursor_ms        bigint not null default 0,

  enabled          boolean not null default true,
  last_run_at      timestamptz,
  last_run_status  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column igopps.accounts.pit_token is
  'GHL Private Integration Token; só acessível via service_role';

-- Uma linha por seguidor que já virou (ou já tinha) oportunidade.
-- Chave por contato garante o "uma vez por seguidor, para sempre".
create table if not exists igopps.created (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references igopps.accounts(id) on delete cascade,
  ghl_contact_id   text not null,
  conversation_id  text,
  contact_name     text,
  ig_handle        text,
  opportunity_id   text,
  -- 'created' = oportunidade criada por nós; 'existing' = já tinha, só registramos.
  outcome          text not null default 'created' check (outcome in ('created', 'existing')),
  created_at       timestamptz not null default now()
);

create unique index if not exists created_account_contact_idx
  on igopps.created (account_id, ghl_contact_id);

-- Histórico de execuções do reconciliador.
create table if not exists igopps.runs (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid references igopps.accounts(id) on delete cascade,
  trigger          text not null check (trigger in ('cron', 'manual', 'backfill')),
  status           text not null default 'running' check (status in ('running', 'ok', 'error')),
  conversations    integer not null default 0,
  created_count    integer not null default 0,
  existing_count   integer not null default 0,
  skipped_count    integer not null default 0,
  cursor_before    bigint,
  cursor_after     bigint,
  error            text,
  details          jsonb,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz
);

create index if not exists runs_account_idx on igopps.runs (account_id, started_at desc);

alter table igopps.app_config enable row level security;
alter table igopps.accounts   enable row level security;
alter table igopps.created    enable row level security;
alter table igopps.runs       enable row level security;

revoke all on all tables in schema igopps from anon, authenticated;
revoke all on schema igopps from anon, authenticated;
