-- ============================================================================
-- Spark Voice AI — envios agendados de áudio (modal "Configurar envio")
-- Cada linha agenda o envio de um áudio (template) para um contato da location,
-- na data-alvo (ex.: próximo aniversário, derivado do Date of Birth do contato).
-- status:
--   scheduled   → pronto para disparo na send_date
--   missing_dob → contato sem Date of Birth (denunciado na UI até corrigir)
--   sent        → despachado pelo motor de envio
--   cancelled   → cancelado pelo usuário
--   failed      → falha no despacho (ver notas do motor)
-- ============================================================================

create table if not exists spark.audio_sends (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references spark.accounts(id) on delete cascade,
  template_id   uuid references spark.audio_templates(id) on delete set null,
  event_type    text,
  contact_id    text not null,              -- id do contato na location
  contact_name  text,
  contact_phone text,
  dob           date,                       -- Date of Birth do contato (snapshot)
  send_date     date,                       -- próxima ocorrência (aniversário)
  status        text not null default 'scheduled'
                  check (status in ('scheduled','missing_dob','sent','cancelled','failed')),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_sends_account_date
  on spark.audio_sends(account_id, send_date);
create index if not exists idx_sends_status on spark.audio_sends(account_id, status);
drop trigger if exists trg_sends_updated on spark.audio_sends;
create trigger trg_sends_updated before update on spark.audio_sends
  for each row execute function spark.touch_updated_at();
alter table spark.audio_sends enable row level security;
