-- Stevo DND middleware: multi-tenant config + audit
-- Todas as tabelas ficam com RLS habilitado e SEM policies:
-- apenas as edge functions (service role) têm acesso.

create table if not exists public.stevo_clients (
  id uuid primary key default gen_random_uuid(),
  ghl_location_id text not null unique,
  client_name text not null,
  webhook_secret text not null,
  block_on_all_instances boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stevo_instances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.stevo_clients(id) on delete cascade,
  name text not null,
  server_url text not null,
  api_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stevo_instances_client_idx on public.stevo_instances (client_id);

create table if not exists public.stevo_setup_tokens (
  token text primary key,
  client_id uuid not null references public.stevo_clients(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists stevo_setup_tokens_client_idx on public.stevo_setup_tokens (client_id);

create table if not exists public.stevo_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  action text not null,
  ghl_location_id text not null,
  contact_id text,
  phone text,
  instance_name text,
  success boolean not null,
  message text,
  source text,
  reason text
);
create index if not exists stevo_audit_log_location_idx on public.stevo_audit_log (ghl_location_id, created_at desc);

create table if not exists public.stevo_settings (
  key text primary key,
  value text not null
);

alter table public.stevo_clients enable row level security;
alter table public.stevo_instances enable row level security;
alter table public.stevo_setup_tokens enable row level security;
alter table public.stevo_audit_log enable row level security;
alter table public.stevo_settings enable row level security;

-- Seed manual (fora da migração): inserir em stevo_settings a chave
-- 'admin_secret_hash' com o SHA-256 hex do admin secret escolhido.
