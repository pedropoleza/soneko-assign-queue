# ghl-purge-inbound

Mantém **apenas** contatos criados **manualmente** (em "New"), por **importação**
ou por **formulário**. Contatos gerados automaticamente por uma **conversa de
canal** (WhatsApp, Instagram DM, Facebook, SMS, …) são **apagados** (apagar o
contato remove a conversa junto).

> O GoHighLevel sempre cria contato + conversa em qualquer inbound — não dá pra
> impedir nativamente. Por isso o mecanismo é "criar e limpar".

Location alvo: `jIqId5fQTEscL0KB2neG`

## Como decide (inteligente, seguro por padrão)

O sinal decisivo é **a presença de uma conversa de canal inbound**, não o `source`:

| Origem do contato | Tem conversa de canal na criação? | Resultado |
|---|---|---|
| "New" manual | não | **mantém** |
| Importação | não | **mantém** |
| Formulário | não (form não é conversa) | **mantém** |
| WhatsApp / IG / FB / SMS | sim | **apaga** |

Na dúvida (sem conversa / canal não reconhecido) → **mantém**. Nunca apaga um
legítimo; no pior caso um indesejado escapa e a gente ajusta `purge_channel_types`.

## Automação — NÃO precisa de workflow no GHL

Um **cron** (pg_cron, a cada 5 min) chama a função em modo `scan`, que lista os
contatos criados na última janela (`scan_window_sec`), deduplica via `purge_log` e
avalia cada um. Tudo self-contained neste projeto.

> Opcional: também funciona como webhook de um workflow "Contact Created"
> (`POST {"contact_id":"{{contact.id}}"}` com header `x-purge-secret`) — mas com o
> cron isso é dispensável.

## Config (`ghl.purge_config`, ajustável por SQL)

| Coluna | Padrão | Descrição |
|--------|--------|-----------|
| `pit_token` | — | Private Integration Token (escopos **Contacts** + **Conversations**, read+write) |
| `purge_secret` | auto | usado pelo cron / webhook |
| `dry_run` | `true` | `true` só loga; `false` apaga de verdade |
| `max_age_sec` | `300` | proteção de replay (só age em contatos novos) |
| `keep_tags` | `{keep,manual,form}` | tags que sempre protegem |
| `purge_channel_types` | `{phone,sms,whatsapp,fb,messenger,ig,instagram,facebook,gmb,live_chat,call}` | tipos de conversa que contam como canal |
| `scan_window_sec` | `1800` | janela do scan (30 min) |

```sql
-- 1) setar o token:
update ghl.purge_config set pit_token = '<PIT_TOKEN>';

-- 2) acompanhar as decisões (dry-run):
select created_at, action, reason, source, channel, contact_id
from ghl.purge_log order by created_at desc limit 50;

-- 3) ver os tipos de conversa que apareceram (pra afinar):
select reason, count(*) from ghl.purge_log group by reason order by 2 desc;

-- 4) armar quando estiver confiante:
update ghl.purge_config set dry_run = false;
```

## Rollout seguro

1. **Agora:** deployado em **dry-run**, cron rodando a cada 5 min — só grava em
   `ghl.purge_log` o que *apagaria* (`would_delete`) vs *manteria* (`kept`).
2. Setar o `pit_token`; criar 1 contato de teste por canal e 1 manual/import/form.
3. Conferir no `purge_log` que só os de canal viram `would_delete`.
4. `update ghl.purge_config set dry_run = false;` pra armar.

Function URL: `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/ghl-purge-inbound`
