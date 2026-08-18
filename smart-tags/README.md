# Smart Tags para GoHighLevel

App **independente** (multi-tenant) que transforma **toda tag** de uma subaccount
GHL em uma **opção de um custom field de oportunidade** — virando uma "smart tag"
pesquisável/filtrável no pipeline. Opcionalmente também **preenche o valor** do
campo nas oportunidades do contato.

> Isolado dos demais apps do projeto: schema próprio `smarttags`, edge functions
> `smart-tags-*`, cron `smarttags-sync` e secret próprio. Não lê nem escreve em
> nenhum outro schema (soneko, spark, wa, qr…).

## Por que híbrido (webhook + cron)

O GHL **não emite webhook de "tag criada"**. Só há evento quando uma tag é
*aplicada a um contato*. Então:

| Origem da tag                              | Como é capturada           | Latência   |
|--------------------------------------------|----------------------------|------------|
| Tag aplicada a um lead                     | **webhook** (tempo real)   | segundos   |
| Tag criada em Settings → Tags (sem lead)   | **cron** lê `GET /tags`    | ≤ 15 min   |

Os dois caminhos convergem para a mesma lógica: catalogar a tag e garantir que
ela exista como opção do custom field.

## Componentes

```
smart-tags/
├── sql/
│   ├── 001_schema.sql   # schema smarttags: accounts, tags, sync_runs, events
│   ├── 002_rpcs.sql     # RPCs public.smarttags_* (SECURITY DEFINER, service_role)
│   └── 003_cron.sql     # admin_secret + job pg_cron a cada 15 min
└── functions/
    ├── _shared/core.ts        # núcleo: GHL client, campo, opções, valores, sync
    ├── smart-tags-admin/      # instalar/configurar/sync/backfill/status por conta
    ├── smart-tags-sync/       # reconciliador (cron ou sob demanda)
    └── smart-tags-webhook/    # receptor do webhook do GHL (por conta)
```

Projeto Supabase: **GHL Token** (`tbziahcpkrfiksqhuhpe`).

## Instalação de uma subaccount

Cada subaccount precisa de um **Private Integration Token** (PIT) com escopos de
`locations/customFields`, `opportunities` e `contacts` (leitura/escrita).

```bash
curl -X POST "$SUPABASE_URL/functions/v1/smart-tags-admin/install" \
  -H "x-smarttags-admin: <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "location_id": "<GHL_LOCATION_ID>",
    "pit_token":   "pit-...",
    "field_name":  "Smart Tags",
    "field_data_type": "MULTIPLE_OPTIONS",
    "sync_values": true
  }'
```

A resposta traz o `webhook_secret` e o bloco `webhook` pronto para colar no GHL.
O install já valida o token, cria/resolve o custom field e roda o primeiro sync.

## Webhook no GHL

Em **Automation → Workflows**, crie um workflow com gatilho *Contact Tag Updated*
(e opcionalmente *Contact Created*) e uma ação **Webhook**:

```
POST  <SUPABASE_URL>/functions/v1/smart-tags-webhook
Header: x-smarttags-secret: <webhook_secret da conta>
Body (JSON):
{
  "location_id": "{{location.id}}",
  "contact_id":  "{{contact.id}}",
  "tags":        "{{contact.tags}}"
}
```

O receptor aceita `tags` como array ou string separada por vírgula, e também
`tag`/`tagName` (tag única). Sempre relê as tags vivas do contato pelas suas
oportunidades para refletir remoções.

## Rotas admin (header `x-smarttags-admin`)

| Método | Rota         | Descrição                                                        |
|--------|--------------|------------------------------------------------------------------|
| POST   | `/install`   | Cadastra a conta, provisiona o campo e roda o 1º sync            |
| POST   | `/settings`  | Atualiza config da conta (campo, flags, prefixos ignorados…)     |
| POST   | `/sync`      | Reconcilia uma conta (`location_id`) ou todas                    |
| POST   | `/backfill`  | Carimba o valor nas oportunidades existentes (resumível)         |
| POST   | `/uninstall` | Desativa a conta (`active=false`)                                |
| GET    | `/status`    | Estado da conta: contadores de tags, últimas runs e eventos      |
| GET    | `/accounts`  | Lista as contas (sem expor o PIT)                                |

Backfill é paginado; repita com o cursor `next` até `done: true`.

## Configuração por conta (`smarttags.accounts`)

| Campo             | Padrão             | Efeito                                                    |
|-------------------|--------------------|-----------------------------------------------------------|
| `field_name`      | `Smart Tags`       | Nome do custom field de oportunidade                      |
| `field_data_type` | `MULTIPLE_OPTIONS` | `MULTIPLE_OPTIONS` \| `SINGLE_OPTIONS` \| `CHECKBOX`      |
| `sync_options`    | `true`             | Cataloga toda tag como opção do campo                     |
| `sync_values`     | `true`             | Escreve o valor do campo nas oportunidades do contato     |
| `prune_options`   | `false`            | Remove opções cujas tags sumiram do GHL (destrutivo)      |
| `ignore_prefixes` | `{}`               | Ignora tags que começam com estes prefixos (ex. `[device]`) |

## Segredos

- **admin_secret** — em `smarttags.app_config`. Gere uma vez:
  ```sql
  insert into smarttags.app_config (key, value)
  values ('admin_secret', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (key) do nothing;
  ```
- **webhook_secret** — por conta, gerado no cadastro (`smarttags.accounts`).
- **pit_token** — por conta; só acessível via `service_role`, nunca exposto nas
  respostas da API.

## Comportamento verificado (location Sócios `E6nskmJvk1wDe6FuRAu9`)

- Custom field `Smart Tags` (`MULTIPLE_OPTIONS`) criado via API.
- 103 tags → 85 nomes únicos (o GHL permite tags duplicadas) sincronizados como opções.
- Escrita e leitura do valor numa oportunidade real confirmadas.
- Webhook ponta a ponta: tag → opção → valor na oportunidade.
