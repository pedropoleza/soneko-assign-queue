-- ============================================================================
-- Cotação Leão — persistence schema (CLAUDE.md §5)
-- Isolated schema `spark_cotacao`, accessed ONLY through SECURITY DEFINER RPCs
-- in `public` granted to service_role — the same isolation model as spark_saude.
-- Nothing here is exposed to anon/authenticated or to other projects.
-- Apply once (Supabase SQL editor / migration) after the schema is approved.
-- ============================================================================

create schema if not exists spark_cotacao;
revoke all on schema spark_cotacao from anon, authenticated;

-- --- Tables -----------------------------------------------------------------

create table if not exists spark_cotacao.quote (
  id              uuid primary key,
  ghl_contact_id  text,
  corretora_id    text not null,                       -- multi-tenant (location)
  created_at      timestamptz not null default now(),
  zipcode         text not null,
  state           text not null,
  countyfips      text,
  income          numeric not null,
  year            int  not null,
  status          text not null default 'rascunho'
                   check (status in ('rascunho','enviada','respondida')),
  proposal_token  text not null unique,
  token_expires_at timestamptz not null,
  household_json  jsonb not null
);
create index if not exists quote_contact_idx on spark_cotacao.quote (ghl_contact_id);
create index if not exists quote_corretora_idx on spark_cotacao.quote (corretora_id, created_at desc);

create table if not exists spark_cotacao.quote_option (
  id               uuid primary key,
  quote_id         uuid not null references spark_cotacao.quote(id) on delete cascade,
  plan_id          text,
  seguradora       text,
  nome_plano       text,
  metal_level      text,
  premio_mensal    numeric,          -- estimado, com crédito
  premio_sem_credito numeric,        -- bruto, antes do crédito
  credito_fiscal   numeric,
  dedutivel        numeric,
  max_bolso        numeric,
  atencao_primaria     text,
  atencao_especialista text,
  atencao_urgencia     text,
  emergencia           text,
  saude_mental         text,
  medicamento_generico text,
  print_url        text,             -- URL assinada do print (storage privado, §6)
  fonte            text not null default 'api' check (fonte in ('api','manual'))
);
create index if not exists quote_option_quote_idx on spark_cotacao.quote_option (quote_id);

create table if not exists spark_cotacao.quote_option_response (
  id               uuid primary key default gen_random_uuid(),
  quote_option_id  uuid not null references spark_cotacao.quote_option(id) on delete cascade,
  decisao          text not null check (decisao in ('aprovado','recusado')),
  comentario       text,
  respondido_em    timestamptz not null default now(),
  ip_hash          text               -- auditoria leve (hash, não IP cru)
);
create index if not exists response_option_idx on spark_cotacao.quote_option_response (quote_option_id);

-- --- RPCs (SECURITY DEFINER, service_role only) -----------------------------

create or replace function public.spark_cotacao_create_quote(p_quote jsonb)
returns void language plpgsql security definer set search_path = spark_cotacao, public as $$
declare opt jsonb;
begin
  insert into spark_cotacao.quote
    (id, ghl_contact_id, corretora_id, created_at, zipcode, state, countyfips,
     income, year, status, proposal_token, token_expires_at, household_json)
  values (
    (p_quote->>'id')::uuid, p_quote->>'ghlContactId', p_quote->>'corretoraId',
    coalesce((p_quote->>'createdAt')::timestamptz, now()),
    p_quote->>'zipcode', p_quote->>'state', p_quote->>'countyfips',
    (p_quote->>'income')::numeric, (p_quote->>'year')::int,
    coalesce(p_quote->>'status','rascunho'),
    p_quote->>'proposalToken', (p_quote->>'tokenExpiresAt')::timestamptz,
    coalesce(p_quote->'householdJson', '{}'::jsonb));

  for opt in select * from jsonb_array_elements(coalesce(p_quote->'options','[]'::jsonb)) loop
    insert into spark_cotacao.quote_option
      (id, quote_id, plan_id, seguradora, nome_plano, metal_level, premio_mensal,
       premio_sem_credito, credito_fiscal, dedutivel, max_bolso, atencao_primaria,
       atencao_especialista, atencao_urgencia, emergencia, saude_mental,
       medicamento_generico, print_url, fonte)
    values (
      (opt->>'id')::uuid, (p_quote->>'id')::uuid, opt->>'planId', opt->>'seguradora',
      opt->>'nomePlano', opt->>'metalLevel', (opt->>'premioMensal')::numeric,
      (opt->>'premioSemCredito')::numeric, (opt->>'creditoFiscal')::numeric,
      nullif(opt->>'dedutivel','')::numeric, nullif(opt->>'maxBolso','')::numeric,
      opt->>'atencaoPrimaria', opt->>'atencaoEspecialista', opt->>'atencaoUrgencia',
      opt->>'emergencia', opt->>'saudeMental', opt->>'medicamentoGenerico',
      opt->>'printUrl', coalesce(opt->>'fonte','api'));
  end loop;
end $$;

create or replace function public.spark_cotacao_get_quote(p_id uuid)
returns jsonb language sql security definer set search_path = spark_cotacao, public as $$
  select to_jsonb(q) || jsonb_build_object(
    'options', coalesce((
      select jsonb_agg(to_jsonb(o) || jsonb_build_object(
        'response', (select to_jsonb(r) from spark_cotacao.quote_option_response r
                     where r.quote_option_id = o.id order by r.respondido_em desc limit 1)))
      from spark_cotacao.quote_option o where o.quote_id = q.id), '[]'::jsonb))
  from spark_cotacao.quote q where q.id = p_id;
$$;

create or replace function public.spark_cotacao_record_response(
  p_option_id uuid, p_decisao text, p_comentario text, p_ip_hash text)
returns void language plpgsql security definer set search_path = spark_cotacao, public as $$
begin
  insert into spark_cotacao.quote_option_response (quote_option_id, decisao, comentario, ip_hash)
  values (p_option_id, p_decisao, p_comentario, p_ip_hash);
  update spark_cotacao.quote set status = 'respondida'
  where id = (select quote_id from spark_cotacao.quote_option where id = p_option_id);
end $$;

revoke all on function public.spark_cotacao_create_quote(jsonb) from public, anon, authenticated;
revoke all on function public.spark_cotacao_get_quote(uuid) from public, anon, authenticated;
revoke all on function public.spark_cotacao_record_response(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.spark_cotacao_create_quote(jsonb) to service_role;
grant execute on function public.spark_cotacao_get_quote(uuid) to service_role;
grant execute on function public.spark_cotacao_record_response(uuid, text, text, text) to service_role;
