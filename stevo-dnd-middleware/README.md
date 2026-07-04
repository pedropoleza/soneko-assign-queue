# stevo-dnd-middleware

Middleware que recebe webhooks de automações do **GoHighLevel (GHL)** e bloqueia/desbloqueia contatos no WhatsApp via **Stevo / StevoManager V2**.

Fluxo: contato marcado como DND (ou tag adicionada) no GHL → workflow dispara Custom Webhook → o middleware identifica o cliente pela `locationId` → chama a API do Stevo na(s) instância(s) correta(s) → registra auditoria → responde ao GHL com sucesso, falha parcial ou erro.

## ⚡ Versão em produção: Supabase Edge Functions + páginas no app

A versão ativa roda no projeto Supabase **GHL Token** (`tbziahcpkrfiksqhuhpe`) — código em `supabase/` neste diretório:

| Componente | URL | O que é |
|---|---|---|
| Webhook (GHL chama) | `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/stevo-dnd` | `POST` block/unblock; `GET` = health check |
| Painel admin | `https://SUA_URL/` | Front-end estático **independente** (pasta `web/`): cadastra clientes, gera links de setup, vê auditoria |
| Setup do cliente | `https://SUA_URL/?token=...` | Link único gerado no admin; cadastra as credenciais Stevo com teste de conexão |
| API admin | `.../functions/v1/stevo-admin` | JSON, protegida por admin secret (hash em `stevo_settings`) |
| API setup | `.../functions/v1/stevo-setup` | JSON, protegida por token de setup com expiração (7 dias) |

### Hospedando o painel (pasta `web/`)

O painel é **um único `index.html` autocontido** (sem build, sem dependências) e totalmente separado de qualquer outro app. Publique a pasta `web/` em qualquer host estático, na URL que preferir:

- **Vercel / Netlify / Cloudflare Pages:** aponte para a pasta `stevo-dnd-middleware/web` (sem comando de build) — ou simplesmente arraste a pasta no painel deles.
- Qualquer outro host (S3, Nginx, cPanel...) também funciona.

Os links de setup gerados usam automaticamente o domínio onde a página estiver publicada (`https://sua-url/?token=...`) — nada precisa ser reconfigurado ao trocar de domínio. As chamadas vão direto para as edge functions (CORS liberado), e nenhum segredo fica no HTML.

Dados em Postgres (schema `public`, RLS habilitado sem policies — só as edge functions com service role acessam): `stevo_clients` (com `webhook_secret` **por cliente**), `stevo_instances`, `stevo_setup_tokens`, `stevo_audit_log`, `stevo_settings`.

**Fluxo de onboarding de um cliente novo:**
1. Abra o painel (`https://SUA_URL/`), entre com o admin secret.
2. "Novo cliente": nome + Location ID do GHL → gera o link de setup (válido 7 dias).
3. Envie o link (ou abra você mesmo): a página pede URL do servidor + API Key de cada instância Stevo, com botão **Testar conexão** que valida contra a API real.
4. Ao salvar, a página mostra a configuração pronta do GHL: URL do webhook, header `x-webhook-secret` (secret exclusivo daquele cliente) e os bodies de block/unblock para colar nos workflows.

> As telas ficam em um front-end estático separado (e não nas functions) porque o domínio compartilhado `*.supabase.co` reescreve `text/html` para `text/plain` de propósito (anti-phishing) — documentado em <https://supabase.com/docs/guides/functions/development-tips>.

**Rotação do admin secret:** gere um novo (`openssl rand -hex 24`), calcule o hash (`echo -n "SECRET" | sha256sum`) e atualize `stevo_settings.admin_secret_hash` via SQL.

---

## Versão alternativa: servidor Node standalone

O restante deste README documenta a versão Node.js + Express (`src/`), funcionalmente equivalente ao webhook (config via `.env` em vez de banco). Útil se preferir hospedar em VPS/Railway/Render em vez do Supabase.

---

## API do Stevo — formato validado

Validado no **OpenAPI oficial do StevoManager v2** (`https://smv2-1.stevo.chat/swagger/doc.json`, exposto em `https://doc.stevo.chat/api-reference`):

| Item | Valor validado |
|---|---|
| Base URL | `https://smv2-N.stevo.chat` (por instância; exibido no painel StevoManager V2) |
| Bloquear | `POST /user/block` |
| Desbloquear | `POST /user/unblock` |
| Lista de bloqueados | `GET /user/blocklist` (sem body) |
| Header de autenticação | `apikey: <API Key da instância>` |
| Content-Type | `application/json` |
| Body (block/unblock) | `{ "number": "5538999999999" }` |
| Erro | JSON `{ "error": "mensagem" }` — 400 validação, 401 apikey inválida, 500 interno |
| Sucesso | HTTP 200 (o spec declara o corpo como objeto livre — ver "Pontos pendentes") |

**Pontos que ainda dependem de validação com uma instância real** (o spec não documenta):
1. O corpo exato da resposta 200 de block/unblock/blocklist.
2. O formato exato de telefone aceito — `5538999999999` (dígitos com DDI) é o padrão da família whatsmeow e o mais provável, mas a API pode também aceitar JID (`5538999999999@s.whatsapp.net`).
3. Comportamento ao bloquear um número que não é WhatsApp válido.

Por isso o `stevo.client.ts` é 100% configurável via `.env`: `STEVO_API_KEY_HEADER`, `STEVO_BLOCK_PATH`, `STEVO_UNBLOCK_PATH`, `STEVO_BLOCKLIST_PATH`, `STEVO_PHONE_FIELD` (ex.: trocar `number` por `phone`/`jid`) e `STEVO_TIMEOUT_MS` — sem tocar em código.

---

## Arquitetura

```
stevo-dnd-middleware/
├── src/
│   ├── index.ts                    # bootstrap (porta, listen)
│   ├── server.ts                   # Express app + handler central de erros
│   ├── routes/
│   │   ├── webhook.routes.ts       # POST /webhooks/ghl/stevo-dnd
│   │   └── health.routes.ts        # GET /health
│   ├── controllers/
│   │   └── webhook.controller.ts   # valida payload (Zod) e monta a resposta
│   ├── middleware/
│   │   └── auth.middleware.ts      # exige x-webhook-secret (comparação constante)
│   ├── services/
│   │   ├── stevo.service.ts        # orquestra: location -> telefone -> instâncias -> auditoria
│   │   ├── location.service.ts     # resolve locationId -> instâncias ativas
│   │   └── audit.service.ts        # auditoria estruturada (pronto p/ evoluir p/ banco)
│   ├── clients/
│   │   └── stevo.client.ts         # HTTP isolado p/ API Stevo (timeout, erros, sem vazar apikey)
│   ├── utils/
│   │   ├── phone-normalizer.ts     # +55 (38) 99999-9999 -> 5538999999999
│   │   ├── errors.ts               # erros de domínio com status HTTP
│   │   └── logger.ts               # Pino com redação automática de apiKey
│   ├── schemas/
│   │   └── webhook.schema.ts       # Zod schema do payload do GHL
│   └── config/
│       ├── env.ts                  # validação das variáveis de ambiente (Zod)
│       └── locations.ts            # mapa locationId -> instâncias Stevo
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

**Stack:** Express 4, Zod, Pino, `fetch` nativo do Node (≥ 18.17) com `AbortController` para timeout. Sem frontend, sem banco (por enquanto).

---

## Como rodar

```bash
cd stevo-dnd-middleware
npm install
cp .env.example .env
# edite o .env: WEBHOOK_SECRET, locationId e credenciais Stevo
npm run dev        # desenvolvimento (tsx watch, logs coloridos)
```

Build de produção:

```bash
npm run build      # compila para dist/
npm start          # node dist/index.js
```

---

## Configurando o `.env`

Veja `.env.example`. Os campos essenciais:

- `WEBHOOK_SECRET` — segredo que o GHL enviará no header `x-webhook-secret`. Use um valor longo e aleatório (ex.: `openssl rand -hex 32`).
- `GHL_CLIENT_1_LOCATION_ID` — Location ID do subaccount no GHL (**Settings → Business Profile → Location ID**).
- `STEVO_CLIENT_1_MAIN_SERVER_URL` — URL do servidor da instância, exibida no painel StevoManager V2 (formato `https://smv2-N.stevo.chat`).
- `STEVO_CLIENT_1_MAIN_API_KEY` — API Key da instância, copiada do painel StevoManager V2.

### Cadastrando múltiplos clientes (locations)

1. Adicione as variáveis no `.env`:
   ```env
   GHL_CLIENT_2_LOCATION_ID=xxxxx
   STEVO_CLIENT_2_MAIN_SERVER_URL=https://smv2-3.stevo.chat
   STEVO_CLIENT_2_MAIN_API_KEY=yyyyy
   ```
2. Descomente/duplique o bloco "Cliente 2" em `src/config/locations.ts`.
3. Reinicie o serviço.

### Múltiplas instâncias Stevo na mesma location

Adicione mais objetos ao array `stevoInstances` da location em `src/config/locations.ts` (cada um com `name`, `serverUrl`, `apiKey` vindos do `.env` e `active: true`).

- `blockOnAllInstances: true` → bloqueia/desbloqueia em **todas** as instâncias ativas (em paralelo).
- `blockOnAllInstances: false` → processa apenas a primeira instância ativa.
- `active: false` → instância é ignorada (útil para desativar um número sem apagar a config).

---

## Endpoints

### `GET /health`

```json
{ "status": "ok", "service": "stevo-dnd-middleware" }
```

### `POST /webhooks/ghl/stevo-dnd`

Headers obrigatórios:

```
Content-Type: application/json
x-webhook-secret: <WEBHOOK_SECRET do .env>
```

Payload (bloqueio):

```json
{
  "action": "block",
  "locationId": "LOCATION_ID_AQUI",
  "contactId": "CONTACT_ID_AQUI",
  "phone": "+55 38 99999-9999",
  "email": "cliente@email.com",
  "source": "ghl_workflow",
  "reason": "DND WhatsApp habilitado"
}
```

Payload (desbloqueio): igual, com `"action": "unblock"`.

Respostas:

| HTTP | `status` | Significado |
|---|---|---|
| 200 | `success` | Todas as instâncias processadas com sucesso |
| 207 | `partial_success` | Parte das instâncias falhou (campo `results` detalha) |
| 502 | `error` | Todas as instâncias falharam |
| 400 | `error` | Payload inválido / telefone inválido |
| 401 | `error` | `x-webhook-secret` ausente ou incorreto |
| 404 | `error` | `locationId` não configurada no middleware |
| 422 | `error` | Location sem nenhuma instância ativa |

Exemplo de sucesso total:

```json
{
  "success": true,
  "status": "success",
  "action": "block",
  "locationId": "LOCATION_ID_CLIENTE_1",
  "contactId": "CONTACT_ID",
  "phone": "5538999999999",
  "results": [
    { "instance": "Número Principal", "success": true }
  ]
}
```

Exemplo de falha parcial (HTTP 207):

```json
{
  "success": false,
  "status": "partial_success",
  "action": "block",
  "locationId": "LOCATION_ID_CLIENTE_1",
  "contactId": "CONTACT_ID",
  "phone": "5538999999999",
  "results": [
    { "instance": "Número Principal", "success": true },
    { "instance": "Número Secundário", "success": false, "error": "Timeout após 15000ms ao chamar a instância Stevo" }
  ]
}
```

---

## Testes com cURL

Health:

```bash
curl http://localhost:3000/health
```

Bloqueio:

```bash
curl -X POST "http://localhost:3000/webhooks/ghl/stevo-dnd" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: troque_este_valor" \
  -d '{
    "action": "block",
    "locationId": "LOCATION_ID_CLIENTE_1",
    "contactId": "CONTACT_ID_TESTE",
    "phone": "+55 38 99999-9999",
    "source": "manual_test",
    "reason": "Teste de bloqueio"
  }'
```

Desbloqueio:

```bash
curl -X POST "http://localhost:3000/webhooks/ghl/stevo-dnd" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: troque_este_valor" \
  -d '{
    "action": "unblock",
    "locationId": "LOCATION_ID_CLIENTE_1",
    "contactId": "CONTACT_ID_TESTE",
    "phone": "+55 38 99999-9999",
    "source": "manual_test",
    "reason": "Teste de desbloqueio"
  }'
```

Erro 401 (header ausente):

```bash
curl -i -X POST "http://localhost:3000/webhooks/ghl/stevo-dnd" \
  -H "Content-Type: application/json" \
  -d '{"action":"block","locationId":"X","contactId":"Y","phone":"+55 38 99999-9999"}'
```

Erro 400 (telefone ausente):

```bash
curl -i -X POST "http://localhost:3000/webhooks/ghl/stevo-dnd" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: troque_este_valor" \
  -d '{"action":"block","locationId":"LOCATION_ID_CLIENTE_1","contactId":"Y"}'
```

Erro 404 (location não configurada):

```bash
curl -i -X POST "http://localhost:3000/webhooks/ghl/stevo-dnd" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: troque_este_valor" \
  -d '{"action":"block","locationId":"LOCATION_INEXISTENTE","contactId":"Y","phone":"+55 38 99999-9999"}'
```

---

## Configuração no GoHighLevel

### Workflow de bloqueio

1. **Automation → Workflows → Create Workflow**.
2. **Trigger** (escolha um):
   - *Contact DND* — quando DND for habilitado para o canal WhatsApp; **ou**
   - *Contact Tag* — tag `stevo_block_whatsapp` adicionada.
3. **Ação: Custom Webhook**
   - Method: `POST`
   - URL: `https://SEU_DOMINIO/webhooks/ghl/stevo-dnd`
   - Headers:
     - `Content-Type: application/json`
     - `x-webhook-secret: <mesmo valor do WEBHOOK_SECRET>`
   - Body (Custom Data / JSON):
     ```json
     {
       "action": "block",
       "locationId": "{{location.id}}",
       "contactId": "{{contact.id}}",
       "phone": "{{contact.phone}}",
       "email": "{{contact.email}}",
       "source": "ghl_workflow",
       "reason": "DND WhatsApp habilitado"
     }
     ```

### Workflow de desbloqueio

Mesma estrutura, com:

- **Trigger:** DND removido para WhatsApp, ou tag `stevo_unblock_whatsapp` adicionada.
- **Body:** `"action": "unblock"` e `"reason": "DND WhatsApp removido"`.

> Dica: se usar o trigger de tag, adicione uma ação final no workflow para remover a própria tag, permitindo reprocessar o contato no futuro.

---

## Segurança

- O endpoint exige `x-webhook-secret` (comparação em tempo constante) — sem ele, 401.
- API Keys do Stevo vivem **apenas no `.env`** (que está no `.gitignore`) — nunca no código, nunca no frontend.
- O logger (Pino) redige automaticamente qualquer campo `apiKey` que apareça em objetos logados.
- Mensagens de erro repassadas ao GHL são sanitizadas: se por acaso contiverem a apiKey, ela é substituída por `[REDACTED]` e truncadas em 300 caracteres.
- Use HTTPS em produção (reverse proxy — Caddy/Nginx/Cloudflare — na frente do Node).
- Rotacione o `WEBHOOK_SECRET` se houver suspeita de vazamento (troque no `.env` e nos workflows do GHL).

## Auditoria

Cada operação por instância gera um log estruturado `[AUDIT]` com: timestamp, action, locationId, clientName, contactId, telefone normalizado, instância, sucesso/erro, mensagem resumida, source e reason. API Keys nunca são registradas. Em produção, direcione o stdout para seu agregador de logs (Docker logs, Datadog, Loki, etc.).

## Depuração de erros

1. **401** — header `x-webhook-secret` divergente entre GHL e `.env`.
2. **404 unknown_location** — o `locationId` recebido não existe em `src/config/locations.ts`; confira se o workflow envia `{{location.id}}` e se o `.env` tem o ID correto.
3. **400 invalid_phone** — telefone vazio ou fora do padrão; verifique o campo `{{contact.phone}}` no GHL.
4. **207/502 com erro nas instâncias** — veja o campo `error` de cada instância na resposta e os logs `[AUDIT]`:
   - `not authorized` → API Key errada ou expirada (painel StevoManager V2);
   - `Timeout...` → servidor Stevo lento/indisponível ou `serverUrl` errado;
   - erro 400 do Stevo → formato de telefone rejeitado; teste ajustar `STEVO_PHONE_FIELD` ou o formato (dígitos vs JID).
5. Aumente `LOG_LEVEL=debug` para mais detalhes.

---

## Próximos passos (evolução sugerida)

1. **Banco de dados** — mover `config/locations.ts` para Postgres/Supabase (`locations`, `stevo_instances`, `audit_log`), mantendo as interfaces de `location.service.ts` e `audit.service.ts`; permite cadastrar clientes sem redeploy.
2. **Fila + retry** — enfileirar as chamadas ao Stevo (BullMQ/Redis) com retry exponencial e dead-letter queue; o webhook responde 202 imediatamente e o GHL não sofre com timeouts do Stevo.
3. **Reconciliação** — job periódico que usa `GET /user/blocklist` para conferir se o estado real das instâncias bate com o esperado e corrigir divergências.
4. **Painel administrativo** — UI simples (pode reutilizar o padrão do soneko-assign-queue) para cadastrar locations/instâncias e consultar a auditoria.
5. **Idempotência** — deduplicar webhooks repetidos do GHL por `contactId + action` em janela curta.
