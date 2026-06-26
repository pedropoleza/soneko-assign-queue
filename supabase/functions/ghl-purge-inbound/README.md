# ghl-purge-inbound

Mantém **apenas** contatos criados **manualmente** ("New"), por **importação** ou
por **formulário**. Contatos gerados automaticamente por um **canal de atendimento**
(WhatsApp, Instagram DM, Facebook, SMS) são **apagados** na hora (apagar o contato
remove a conversa junto).

**Arquitetura: event-driven (webhook). Sem cron, sem polling, sem listas.** O GHL
chama a função **uma única vez, no momento da criação do contato**.

Location: `jIqId5fQTEscL0KB2neG`

## Como decide (sinal nativo do GHL: `createdBy.source`)

| `createdBy.source` | Origem | Resultado |
|---|---|---|
| `INTEGRATION` | canal (WhatsApp/IG/FB/SMS) | **apaga** |
| `WEB_USER` / `MANUAL` | "New" manual | mantém |
| `null` / `BULK_ACTION` | importação | mantém |
| `FORM` / `SURVEY` | formulário | mantém |

Apaga só quando `createdBy.source ∈ purge_created_by_sources` (default `{INTEGRATION}`)
**e** existe uma conversa de canal (confirmação contra integrações não-mensageria
tipo Zapier; desligável com `require_channel_conversation=false`). Tudo o mais →
mantém. Seguro por padrão.

## Setup no GoHighLevel (1 workflow)

**Workflow "Purgar inbound":**
- **Trigger:** `Contact Created`
- **Ação:** Webhook → `POST`
  - URL: `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/ghl-purge-inbound`
  - Header: `x-purge-secret: <purge_secret>`
  - Body (Custom JSON): `{ "contact_id": "{{contact.id}}" }`

Latência típica: ~2-7s (o único `sleep` do sistema é a confirmação da conversa,
que pode levar 1-2s pra indexar). Sem nenhuma requisição quando nada acontece.

## Config (`ghl.purge_config`, por SQL)

| Coluna | Padrão | Descrição |
|--------|--------|-----------|
| `pit_token` | — | Private Integration Token (Contacts + Conversations) |
| `purge_secret` | auto | enviado pelo workflow em `x-purge-secret` |
| `dry_run` | `false` (armado) | `true` só loga, não apaga |
| `keep_tags` | `{keep,manual,form}` | tags que sempre protegem |
| `purge_created_by_sources` | `{INTEGRATION}` | quais `createdBy.source` apagar |
| `purge_channel_types` | `{phone,sms,whatsapp,fb,messenger,ig,...}` | tipos de conversa de canal |
| `require_channel_conversation` | `true` | exigir conversa de canal como confirmação |

```sql
-- pausar a qualquer momento:
update ghl.purge_config set dry_run = true;
-- auditoria (só exclusões em produção):
select created_at, action, reason, source, contact_id from ghl.purge_log
order by created_at desc;
```

## Auditoria limpa

Em produção, `ghl.purge_log` recebe **apenas exclusões** (`deleted` /
`delete_failed`) — uma linha por contato removido, nunca por contato mantido. Em
dry-run, registra todas as decisões para validação.

Function URL: `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/ghl-purge-inbound`
