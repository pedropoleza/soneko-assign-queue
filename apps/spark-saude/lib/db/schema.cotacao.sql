-- ============================================================================
-- Cotação Leão — persistence schema (docs/cotacao.md §5)
-- Isolated schema `spark_cotacao`, accessed ONLY through SECURITY DEFINER RPCs
-- in `public` granted to service_role — the same isolation model as spark_saude.
-- Nothing here is exposed to anon/authenticated or to other projects.
--
-- This file is the source of truth and is idempotent: re-running it is safe.
-- Applied to the pilot project via Supabase migrations.
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
  household_json  jsonb not null,
  -- Plano que a corretora destacou como recomendado (mostrado ao cliente).
  recommended_plan_id text
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

-- Real CMS plan attributes a broker compares on (added after the first release).
alter table spark_cotacao.quote_option add column if not exists tipo_plano text;             -- HMO / PPO / EPO / POS
alter table spark_cotacao.quote_option add column if not exists quality_rating numeric;      -- CMS star rating 1-5
alter table spark_cotacao.quote_option add column if not exists hsa_elegivel boolean;
alter table spark_cotacao.quote_option add column if not exists custo_anual_estimado numeric; -- oopc

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
-- The app speaks camelCase end to end, so these RPCs take and return camelCase
-- JSON and do the snake_case mapping here. Returning raw `to_jsonb(row)` would
-- leak column names the TypeScript types don't have.

create or replace function public.spark_cotacao_create_quote(p_quote jsonb)
returns void language plpgsql security definer set search_path = spark_cotacao, public as $$
declare opt jsonb;
begin
  insert into spark_cotacao.quote
    (id, ghl_contact_id, corretora_id, created_at, zipcode, state, countyfips,
     income, year, status, proposal_token, token_expires_at, household_json,
     recommended_plan_id)
  values (
    (p_quote->>'id')::uuid, p_quote->>'ghlContactId', p_quote->>'corretoraId',
    coalesce((p_quote->>'createdAt')::timestamptz, now()),
    p_quote->>'zipcode', p_quote->>'state', p_quote->>'countyfips',
    (p_quote->>'income')::numeric, (p_quote->>'year')::int,
    coalesce(p_quote->>'status','rascunho'),
    p_quote->>'proposalToken', (p_quote->>'tokenExpiresAt')::timestamptz,
    coalesce(p_quote->'householdJson', '{}'::jsonb),
    p_quote->>'recommendedPlanId');

  for opt in select * from jsonb_array_elements(coalesce(p_quote->'options','[]'::jsonb)) loop
    insert into spark_cotacao.quote_option
      (id, quote_id, plan_id, seguradora, nome_plano, metal_level, premio_mensal,
       premio_sem_credito, credito_fiscal, dedutivel, max_bolso, atencao_primaria,
       atencao_especialista, atencao_urgencia, emergencia, saude_mental,
       medicamento_generico, tipo_plano, quality_rating, hsa_elegivel,
       custo_anual_estimado, print_url, fonte)
    values (
      (opt->>'id')::uuid, (p_quote->>'id')::uuid, opt->>'planId', opt->>'seguradora',
      opt->>'nomePlano', opt->>'metalLevel', (opt->>'premioMensal')::numeric,
      (opt->>'premioSemCredito')::numeric, (opt->>'creditoFiscal')::numeric,
      nullif(opt->>'dedutivel','')::numeric, nullif(opt->>'maxBolso','')::numeric,
      opt->>'atencaoPrimaria', opt->>'atencaoEspecialista', opt->>'atencaoUrgencia',
      opt->>'emergencia', opt->>'saudeMental', opt->>'medicamentoGenerico',
      opt->>'tipoPlano', nullif(opt->>'qualityRating','')::numeric,
      nullif(opt->>'hsaElegivel','')::boolean, nullif(opt->>'custoAnualEstimado','')::numeric,
      opt->>'printUrl', coalesce(opt->>'fonte','api'));
  end loop;
end $$;

create or replace function public.spark_cotacao_get_quote(p_id uuid)
returns jsonb language sql security definer set search_path = spark_cotacao, public as $$
  select jsonb_build_object(
    'id', q.id,
    'ghlContactId', q.ghl_contact_id,
    'corretoraId', q.corretora_id,
    'createdAt', q.created_at,
    'zipcode', q.zipcode,
    'state', q.state,
    'countyfips', q.countyfips,
    'income', q.income,
    'year', q.year,
    'status', q.status,
    'proposalToken', q.proposal_token,
    'tokenExpiresAt', q.token_expires_at,
    'householdJson', q.household_json,
    'recommendedPlanId', q.recommended_plan_id,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'quoteId', o.quote_id,
        'planId', o.plan_id,
        'seguradora', o.seguradora,
        'nomePlano', o.nome_plano,
        'metalLevel', o.metal_level,
        'premioMensal', o.premio_mensal,
        'premioSemCredito', o.premio_sem_credito,
        'creditoFiscal', o.credito_fiscal,
        'dedutivel', o.dedutivel,
        'maxBolso', o.max_bolso,
        'atencaoPrimaria', o.atencao_primaria,
        'atencaoEspecialista', o.atencao_especialista,
        'atencaoUrgencia', o.atencao_urgencia,
        'emergencia', o.emergencia,
        'saudeMental', o.saude_mental,
        'medicamentoGenerico', o.medicamento_generico,
        'tipoPlano', o.tipo_plano,
        'qualityRating', o.quality_rating,
        'hsaElegivel', o.hsa_elegivel,
        'custoAnualEstimado', o.custo_anual_estimado,
        'printUrl', o.print_url,
        'fonte', o.fonte,
        'response', (
          select jsonb_build_object(
            'id', r.id,
            'quoteOptionId', r.quote_option_id,
            'decisao', r.decisao,
            'comentario', r.comentario,
            'respondidoEm', r.respondido_em)
          from spark_cotacao.quote_option_response r
          where r.quote_option_id = o.id
          order by r.respondido_em desc limit 1)
      ) order by o.premio_mensal nulls last)
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
