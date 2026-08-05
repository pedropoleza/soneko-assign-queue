# Migrations do Talk Link (schema `wa`)

As migrations já estão aplicadas no projeto Supabase `GHL Token`
(`tbziahcpkrfiksqhuhpe`) e registradas em `supabase_migrations.schema_migrations`,
que é a fonte de verdade. Na ordem:

| Versão | Nome | O que faz |
|---|---|---|
| `20260805011727` | `wa_link_tracking_schema` | schema `wa`, tabelas, índices, RLS, helpers (`norm`, `short_code`, `digits`) |
| `20260805012035` | `wa_link_tracking_rpcs_core` | `wa_config`, `wa_auth`, `wa_upsert_install`, tokens, `wa_lookup`, `wa_record_click`, `wa_log_event` |
| `20260805012123` | `wa_link_tracking_rpcs_app` | CRUD de parceiros, templates, links e settings |
| `20260805012210` | `wa_link_tracking_rpcs_analytics` | `wa_state`, `wa_link_detail`, `wa_report` |
| `20260805012258` | `wa_link_tracking_matching_engine` | `wa_match_inbound`, `wa_link_contact`, `wa_mark_synced` |
| `20260805013531` | `wa_link_tracking_url_params` | rastreio na própria URL: colunas de origem no clique, slug de 2 segmentos |
| `20260805013608` | `wa_link_tracking_readable_slug_and_source_rollup` | slug legível `parceiro/campanha`; conversão herda a origem do clique |
| `20260805013633` | `wa_link_tracking_source_breakdown` | `wa_by_source` (quebra por `?s=`, `?m=`, `?ct=`) |
| `20260805024404` | `wa_partner_folder_detail` | `wa_partner_detail`: a pasta do influenciador, com desempenho por link e por mês |
| `20260805041318` | `wa_agency_install` | `wa.agencies`, `wa_save_agency`, `wa_get_agency` (instalação no nível agência) |
| `20260805045710` | `wa_marker_carries_source` | o marcador passa a carregar `code*src*content`; `conversions.content` e `conversions.src_source`; `wa_match_inbound` recebe `p_src`/`p_content` |
| `20260805045758` | `wa_by_source_counts_sends_without_click` | envios sem clique correspondente passam a contar na quebra por origem |
| `20260805130951` | `clicks_app_and_geo` | `clicks.app` (navegador embutido do app de origem); `wa_record_click` recebe `p_app` |
| `20260805131046` | `link_detail_exposes_app` | `wa_link_detail` devolve `app` no clique e a quebra `by_app` |

## Exportar os arquivos `.sql` para cá

Com a Supabase CLI autenticada:

```bash
supabase link --project-ref tbziahcpkrfiksqhuhpe
supabase db pull --schema wa,public
```

Os arquivos caem em `supabase/migrations/`.

## Convenções

- Nenhuma tabela do schema `wa` é exposta pelo PostgREST — o schema não está na
  lista de *exposed schemas* da API, e isso é proposital.
- Todo acesso passa por RPCs `public.wa_*` marcadas `SECURITY DEFINER`, com
  `execute` concedido **apenas** para `service_role`.
- RLS ligado em todas as tabelas, sem policies: `anon` e `authenticated` não
  leem nada mesmo que o schema seja exposto por engano no futuro.
