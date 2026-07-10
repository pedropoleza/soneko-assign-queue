# Spark Voice AI — V1

Micro-SaaS multi-tenant que se conecta ao **GoHighLevel** e gera **áudios personalizados com voz clonada** (ElevenLabs) a partir de variáveis do CRM. Cada conta corresponde a uma `location` do GHL, isolada por `account_id`.

Construído no **padrão da casa** (mesmo do `soneko-assign-queue`): frontend Vite + React + Tailwind + Radix, backend 100% em **Supabase Edge Functions** + Postgres + Storage. Sem Vercel.

## Arquitetura

- **Frontend** — Vite + React + TypeScript + Tailwind + Radix. Layout wide, topbar com abas, paleta GHL (branco/cinza/azul). Abas: Dashboard · My Voice · Templates · Generate Test Audio · Audio History · Usage · Settings.
- **Backend** — Supabase (schema `spark`).
  - Tabelas: `accounts`, `oauth_tokens`, `voices`, `audio_templates`, `audio_generations`, `usage_logs`, `webhook_secrets`. RLS deny-all — todo acesso passa pelas Edge Functions com service role, filtrando por `account_id`.
  - Edge Functions:
    - `spark-oauth` — instalação do app GHL (OAuth) e emissão de sessão do painel.
    - `spark-api` — backend do painel (`/state`, `/voices`, `/templates`, `/audio/preview`, `/audio/test`, `/generations`).
    - `spark-ghl-webhook` — recebe o evento do workflow do GHL, gera o áudio real e retorna `audio_url`.
  - Núcleo compartilhado em `supabase/functions/_shared/` (template-engine, content-policy, elevenlabs, storage, usage, security, session, ghl).

## Decisões (D1–D7)

| # | Decisão | Escolha desta V1 |
|---|---------|------------------|
| D1 | Auth do painel | **App GHL com OAuth** (sessão HMAC stateless após o callback) |
| D2 | Clonagem de voz | **Upload de sample** (Instant Voice Clone) |
| D3 | Planos/limites | Starter 100/20k · Growth 500/100k · Agency 2.000/400k · **bloqueio** ao exceder |
| D4 | Política de conteúdo | Sanitiza + **rejeita** por blocklist de alto risco + teto de caracteres |
| D5 | Camada de dados | Supabase Client (service role nas Edge Functions) |
| D6 | Retenção de MP3 | **Bucket privado + URL assinada** (30 dias) |
| D7 | Chaves ElevenLabs | **1 chave central** (por-tenant fica para V2) |

> D3, D4, D6 e D7 são premissas do MVP e podem ser ajustadas pelo Time.

## Variáveis suportadas (allow-list)

`{{first_name}}` `{{full_name}}` `{{phone}}` `{{email}}` `{{business_name}}` `{{user_name}}` `{{appointment_date}}` `{{appointment_time}}` `{{pipeline_stage}}` `{{custom_service}}`

## Rodando localmente

```bash
cd spark-voice-ai
npm install
cp .env.example .env      # preencha VITE_SPARK_API_URL (e VITE_SUPABASE_URL/ANON opcional)
npm run dev               # http://localhost:5173
npm run lint              # typecheck
npm test                  # testes do template-engine + política
```

O painel abre com sessão vinda do OAuth (`/?session=...`). Para dev sem GHL, gere uma sessão manualmente (HMAC com `SPARK_SESSION_SECRET`) ou defina `VITE_SPARK_DEFAULT_SESSION`.

## Env vars

**Frontend (bundle público):** `VITE_SPARK_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (opcional).

**Edge Functions (secrets do Supabase — NUNCA no bundle):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET_NAME`, `ELEVENLABS_API_KEY`, `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_OAUTH_REDIRECT_URI`, `GHL_WEBHOOK_SECRET`, `SPARK_SESSION_SECRET`, `DEFAULT_MONTHLY_AUDIO_LIMIT`, `DEFAULT_MONTHLY_CHARACTER_LIMIT`, `APP_URL`. Para dev sem gastar créditos: `SPARK_TTS_MOCK=1`.

## Banco

```bash
# aplicar a migration inicial (7 tabelas + RPC de uso)
supabase db push
# ou aplicar supabase/migrations/0001_spark_voice_ai_init.sql direto no projeto
```

## Webhook do GHL (produção)

```
POST https://<project-ref>.supabase.co/functions/v1/spark-ghl-webhook
Header: x-spark-webhook-secret: <secret da location>
Body (JSON):
{
  "location":     { "id": "{{location.id}}" },
  "event_type":   "birthday",
  "contact_id":   "{{contact.id}}",
  "contact_name": "{{contact.name}}",
  "contact_phone":"{{contact.phone}}",
  "vars": {
    "first_name": "{{contact.first_name}}",
    "appointment_date": "{{appointment.date}}"
  }
}
```

Resposta: `{ generationId, audio_url, final_text }`. O workflow então envia `audio_url` por WhatsApp/SMS/e-mail.

## Estado da implementação

- ✅ **Etapa 0** — migration das 7 tabelas, `.env.example`, README.
- ✅ **Etapa 1** — esqueleto Vite, camada Supabase, tipos, resolução de `account_id` (OAuth/webhook), `/lib/security`.
- ✅ **Etapas 2–4 (backend)** — template-engine, política de conteúdo, `spark-api`, `spark-oauth`, `spark-ghl-webhook` (com mock de TTS para dev).
- ✅ **Etapas 2–4 (frontend)** — telas My Voice, Templates, Test Audio, History, Usage, Settings.
- ✅ **Deploy no projeto `GHL Token`** (`tbziahcpkrfiksqhuhpe`): schema `spark` + 7 tabelas aplicadas, schema exposto no PostgREST, bucket privado `spark-audio` criado, 3 Edge Functions publicadas (`spark-oauth`, `spark-api`, `spark-ghl-webhook`).
- ⏳ **Secrets das Edge Functions** — a setar no dashboard (Settings → Edge Functions → Secrets): `SPARK_SESSION_SECRET`, `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_OAUTH_REDIRECT_URI`, `GHL_WEBHOOK_SECRET`, `ELEVENLABS_API_KEY`, `APP_URL`, `DEFAULT_MONTHLY_AUDIO_LIMIT`, `DEFAULT_MONTHLY_CHARACTER_LIMIT`. (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` são automáticos.)
- 🟡 **Etapa 5 (QA)** — caminhos de falha do webhook **validados em produção** (account_not_found, invalid_secret, no_template_for_event, content_policy_violation, empty_final_text, limite). O caminho de sucesso roda o pipeline inteiro até o TTS; falta só `ELEVENLABS_API_KEY` (ou `SPARK_TTS_MOCK=1`) para fechar a geração real. Custom page no GHL e hypercare pendentes.

Docs: [`docs/ghl-workflow.md`](docs/ghl-workflow.md) (montar o workflow) · [`docs/runbook.md`](docs/runbook.md) (operação/diagnóstico).

> **Nota de infra:** o schema `spark` é exposto no PostgREST via `ALTER ROLE authenticator SET pgrst.db_schemas`. Se as tabelas derem `PGRST205`, rode `notify pgrst, 'reload schema';`. Para persistência, adicione `spark` em Settings → API → Exposed schemas.

### URLs para o app GHL

- **Redirect URI (OAuth):** `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/spark-oauth/callback`
- **Webhook (workflow):** `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/spark-ghl-webhook`
