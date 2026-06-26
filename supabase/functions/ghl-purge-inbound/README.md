# ghl-purge-inbound

Mantém **apenas** contatos criados **manualmente** ou por **formulário**. Qualquer
contato gerado por mensagem recebida (WhatsApp, Instagram DM, Facebook, SMS, …) é
**apagado** logo após a criação (apagar o contato remove a conversa junto).

> O GoHighLevel sempre cria contato + conversa em qualquer inbound — não dá pra
> impedir nativamente. Por isso o mecanismo é "criar e limpar".

Location alvo: `jIqId5fQTEscL0KB2neG`

## Segurança

- **Dry-run por padrão** (`PURGE_DRY_RUN` != `false`): a função só **loga** o que
  apagaria, sem apagar nada. Só troque para `false` depois de validar os logs.
- **Guarda de recência** (`PURGE_MAX_AGE_SEC`, padrão 300s): só apaga contatos
  recém-criados. Assim, um contato manual/form que **mais tarde** responde num
  canal **não** é apagado.
- **Tags de proteção** (`PURGE_KEEP_TAGS`, padrão `keep,manual,form`) e padrões de
  `source` (form/survey/manual/import/api) sempre são preservados.

## Config (tabela `ghl.purge_config`, ajustável por SQL)

Tudo vive numa linha única em `ghl.purge_config` (lida pela RPC `ghl_purge_config`).
Cada decisão é gravada em `ghl.purge_log` (auditoria do dry-run).

| Coluna | Descrição |
|--------|-----------|
| `pit_token` | Private Integration Token da location (escopo: contacts read+write) |
| `purge_secret` | segredo compartilhado; o workflow envia em `x-purge-secret` (auto-gerado) |
| `dry_run` | `true` (padrão) só loga; `false` apaga de verdade |
| `max_age_sec` | padrão `300` — só apaga contatos mais novos que isso |
| `keep_tags` | padrão `{keep,manual,form}` |

```sql
-- setar o token:
update ghl.purge_config set pit_token = '<PIT_TOKEN>';
-- armar (sair do dry-run) quando estiver confiante:
update ghl.purge_config set dry_run = false;
-- ver o que foi decidido:
select created_at, action, reason, source, channel, contact_id
from ghl.purge_log order by created_at desc limit 50;
```

Function URL: `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/ghl-purge-inbound`

## Setup no GoHighLevel

### 1) Workflow de proteção (forms) — "Marcar form como keep"
- **Trigger:** Form Submitted **e** Survey Submitted (todos).
- **Ação:** Add Tag → `keep`.
- Garante que contatos de formulário nunca sejam apagados, mesmo que mandem msg depois.

### 2) (Opcional) Contatos manuais
- Oriente a equipe a adicionar a tag `keep` ao criar contato manual, **ou** confie
  na guarda de recência (contato manual só correria risco se mandasse inbound nos
  primeiros minutos após ser criado).

### 3) Workflow de purga — "Bloquear inbound não-form"
- **Trigger:** `Customer Replied` (ou `Inbound Message`) cobrindo os canais:
  WhatsApp, Instagram, Facebook, SMS/outros.
- **Filtro (recomendado):** Contact Tag **is not** `keep`.
- **Ação:** Webhook → `POST`:
  - URL: `https://<PROJECT>.supabase.co/functions/v1/ghl-purge-inbound`
  - Header: `x-purge-secret: <PURGE_SECRET>`
  - Body (Custom JSON):
    ```json
    { "contact_id": "{{contact.id}}", "channel": "{{message.type}}" }
    ```

## Rollout seguro

1. Deploy com `PURGE_DRY_RUN=true`.
2. Ligue os workflows e observe os logs da função (Supabase → Functions → Logs):
   procure `WOULD_DELETE` vs `KEPT` e confirme que nenhum contato legítimo cairia.
3. Quando estiver confiante, troque `PURGE_DRY_RUN=false`.
