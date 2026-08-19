# IG Opportunities

Automação externa que **cria uma oportunidade no GHL após a primeira interação de
Instagram** com um seguidor — capturando tanto abordagens feitas via ManyChat
quanto respostas feitas direto no Direct, porque **ambas chegam ao GHL como
conversa de Instagram**.

Uma oportunidade por seguidor, **para sempre** (nunca duplica).

> App independente: schema próprio `igopps`, edge function e cron próprios. Não
> toca em nenhum outro schema (soneko, smarttags, spark, wa, qr…).

## Por que reconciliador (e não webhook/ManyChat)

A interação nem sempre passa pelo ManyChat (às vezes é resposta manual no Direct).
O único ponto que enxerga **todos** os casos é o próprio GHL, que já sincroniza as
conversas de Instagram. Então o módulo lê essas conversas e cria o que falta:

```
Cron (a cada 10 min)
  └─ GET /conversations/search?lastMessageType=TYPE_INSTAGRAM (asc, a partir do cursor)
       └─ para cada contato de IG sem oportunidade:
            → POST /opportunities  (Pré venda / Instagram)
            → registra em igopps.created (dedup: 1 por seguidor, pra sempre)
```

- **Incremental**: cursor por `lastMessageDate` (epoch ms), avançado item a item.
  Se uma execução bater o teto, a próxima retoma exatamente de onde parou — zero
  perda, zero reprocessamento.
- **Dedup atômico**: `igopps_claim_contact` reserva o contato antes de criar;
  contatos já processados (ou que já tinham oportunidade) nunca geram outra.
- **Só daqui pra frente**: `only_after` evita backfill do histórico. Ajuste a data
  (ou use o backfill) se quiser incluir conversas antigas.

## Componentes

```
ig-opportunities/
├── sql/
│   ├── 001_schema.sql   # schema igopps: accounts, created, runs
│   ├── 002_rpcs.sql     # RPCs public.igopps_* (SECURITY DEFINER, service_role)
│   └── 003_cron.sql     # admin_secret + job pg_cron a cada 10 min
└── functions/
    └── ig-opportunities/index.ts   # reconciliador (self-contained)
```

Projeto Supabase: **GHL Token** (`tbziahcpkrfiksqhuhpe`).

## Config por conta (`igopps.accounts`)

| Campo               | Padrão               | Efeito                                              |
|---------------------|----------------------|----------------------------------------------------|
| `pipeline_id`       | —                    | Pipeline destino                                   |
| `stage_id`          | —                    | Etapa destino                                       |
| `opportunity_source`| `instagram`          | Campo `source` da oportunidade                     |
| `name_template`     | `{name}`             | Nome da oportunidade (`{name}` = nome/@handle)     |
| `require_inbound`   | `false`              | Se `true`, só cria após o seguidor responder       |
| `only_after`        | momento do cadastro  | Ignora conversas anteriores a esta data            |
| `cursor_ms`         | `0`                  | Cursor incremental (não editar à mão)              |
| `enabled`           | `true`               | Liga/desliga a conta                               |

**Sócios** já está configurada: pipeline `Pré venda`, etapa `Instagram`,
`require_inbound=false` (toda abordagem vira oportunidade).

## Operação

Rodar sob demanda (mesmo endpoint do cron):

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ig-opportunities" \
  -H "x-igopps-admin: <ADMIN_SECRET>" -H "Content-Type: application/json" \
  -d '{"location_id":"E6nskmJvk1wDe6FuRAu9"}'
```

Resposta: `{ conversations, created, existing, skipped, cursor_before, cursor_after, capped }`.

**Backfill** de conversas antigas: recue `only_after` para a data desejada e rode.
O dedup garante que rodar de novo não cria duplicatas.

**Pausar**: `update igopps.accounts set enabled=false where ghl_location_id='…'`.

## Segredos (fora do repositório)

- **admin_secret** — em `igopps.app_config`. Gere uma vez:
  ```sql
  insert into igopps.app_config (key, value)
  values ('admin_secret', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (key) do nothing;
  ```
- **pit_token** — por conta; só acessível via `service_role`, nunca exposto na API.

## Verificado ao vivo (Sócios `E6nskmJvk1wDe6FuRAu9`)

- 3 conversas de Instagram processadas → 2 oportunidades criadas em Pré venda /
  Instagram, 1 pulada por já ter oportunidade (dedup correto).
- Oportunidades de teste removidas; estado resetado para operação daqui pra frente.
