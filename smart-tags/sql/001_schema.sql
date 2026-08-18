-- Smart Tags — schema multi-tenant
-- Toda tag de uma subaccount GHL vira opção de um custom field de oportunidade.
-- Projeto Supabase: GHL Token (tbziahcpkrfiksqhuhpe)

create schema if not exists smarttags;

-- ---------------------------------------------------------------------------
-- Config global (secret de admin usado pelo cron e pela API administrativa)
-- ---------------------------------------------------------------------------
create table if not exists smarttags.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Uma linha por subaccount instalada
-- ---------------------------------------------------------------------------
create table if not exists smarttags.accounts (
  id               uuid primary key default gen_random_uuid(),
  ghl_location_id  text not null unique,
  name             text,
  -- Private Integration Token da subaccount. Só acessível via service_role.
  pit_token        text not null,
  -- Secret que a subaccount põe no header do webhook.
  webhook_secret   text not null default encode(extensions.gen_random_bytes(24), 'hex'),

  -- Custom field de oportunidade que recebe as tags como opções.
  field_id         text,
  field_key        text,
  field_name       text not null default 'Smart Tags',
  field_data_type  text not null default 'MULTIPLE_OPTIONS'
                     check (field_data_type in ('MULTIPLE_OPTIONS', 'SINGLE_OPTIONS', 'CHECKBOX')),

  -- Sincroniza o catálogo de opções do custom field.
  sync_options     boolean not null default true,
  -- Escreve o valor do campo nas oportunidades do contato.
  sync_values      boolean not null default true,
  -- Remove opções cujas tags sumiram do GHL. Desligado por padrão (destrutivo).
  prune_options    boolean not null default false,
  -- Nomes de tag ignorados (case-insensitive, match por prefixo).
  ignore_prefixes  text[] not null default '{}',

  active           boolean not null default true,
  installed_at     timestamptz not null default now(),
  last_sync_at     timestamptz,
  last_sync_status text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column smarttags.accounts.pit_token is
  'GHL Private Integration Token da subaccount; só acessível via service_role';

-- ---------------------------------------------------------------------------
-- Catálogo de tags conhecidas por conta
-- O GHL permite tags com nome duplicado (ids diferentes), então a chave é o nome
-- normalizado e os ids ficam agregados em ghl_tag_ids.
-- ---------------------------------------------------------------------------
create table if not exists smarttags.tags (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references smarttags.accounts(id) on delete cascade,
  name             text not null,
  name_key         text generated always as (lower(btrim(name))) stored,
  ghl_tag_ids      text[] not null default '{}',
  -- true quando o nome já consta no picklist do custom field
  is_option        boolean not null default false,
  source           text not null default 'poll' check (source in ('poll', 'webhook', 'manual')),
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  option_synced_at timestamptz,
  -- preenchido quando a tag deixou de existir no GHL
  missing_since    timestamptz
);

create unique index if not exists tags_account_name_key_idx
  on smarttags.tags (account_id, name_key);
create index if not exists tags_account_option_idx
  on smarttags.tags (account_id, is_option);

-- ---------------------------------------------------------------------------
-- Histórico de sincronizações (cron, manual, install)
-- ---------------------------------------------------------------------------
create table if not exists smarttags.sync_runs (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid references smarttags.accounts(id) on delete cascade,
  trigger               text not null check (trigger in ('cron', 'manual', 'install', 'webhook', 'backfill')),
  status                text not null default 'running' check (status in ('running', 'ok', 'error')),
  tags_seen             integer not null default 0,
  tags_new              integer not null default 0,
  options_before        integer,
  options_after         integer,
  options_added         text[] not null default '{}',
  options_removed       text[] not null default '{}',
  opportunities_updated integer not null default 0,
  error                 text,
  details               jsonb,
  started_at            timestamptz not null default now(),
  finished_at           timestamptz
);

create index if not exists sync_runs_account_idx
  on smarttags.sync_runs (account_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Log cru dos webhooks recebidos
-- ---------------------------------------------------------------------------
create table if not exists smarttags.events (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid references smarttags.accounts(id) on delete set null,
  ghl_location_id       text,
  event_type            text,
  contact_id            text,
  payload               jsonb not null,
  tags_new              text[] not null default '{}',
  opportunities_updated integer not null default 0,
  status                text not null default 'received'
                          check (status in ('received', 'ok', 'ignored', 'error')),
  error                 text,
  received_at           timestamptz not null default now(),
  processed_at          timestamptz
);

create index if not exists events_account_idx
  on smarttags.events (account_id, received_at desc);
create index if not exists events_status_idx
  on smarttags.events (status, received_at desc);

-- ---------------------------------------------------------------------------
-- Nada aqui é exposto via PostgREST: acesso só por service_role (edge functions)
-- ---------------------------------------------------------------------------
alter table smarttags.app_config enable row level security;
alter table smarttags.accounts   enable row level security;
alter table smarttags.tags       enable row level security;
alter table smarttags.sync_runs  enable row level security;
alter table smarttags.events     enable row level security;

revoke all on all tables in schema smarttags from anon, authenticated;
revoke all on schema smarttags from anon, authenticated;
