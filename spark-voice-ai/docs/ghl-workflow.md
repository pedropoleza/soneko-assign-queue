# Guia — Montar o workflow no GoHighLevel

Como configurar um workflow do GHL para gerar um áudio personalizado com o Spark Voice AI e enviá-lo ao contato por WhatsApp/SMS/e-mail.

## Pré-requisitos

- App Spark Voice AI instalado na location (OAuth concluído — a conta é provisionada no primeiro acesso ao painel).
- No painel: **uma voz ativa com consentimento** e **pelo menos um template ativo** cujo `event_type` você vai usar no workflow.
- A Shared Secret Key do app (header do webhook).

## Passo a passo

### 1. Criar o workflow e o trigger
Em **Automation → Workflows → Create Workflow**, escolha o gatilho que faz sentido para o evento (ex.: *Contact Created* para `new_lead`, *Birthday Reminder* para `birthday`, *Appointment* para `reminder`).

### 2. Adicionar a ação Webhook
Adicione uma ação **Webhook** com:

- **Method:** `POST`
- **URL:** `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/spark-ghl-webhook`
- **Headers:**
  - `Content-Type: application/json`
  - `x-spark-webhook-secret: <SUA_SHARED_SECRET_KEY>`
- **Body (JSON):**

```json
{
  "location":     { "id": "{{location.id}}" },
  "event_type":   "new_lead",
  "contact_id":   "{{contact.id}}",
  "contact_name": "{{contact.name}}",
  "contact_phone":"{{contact.phone}}",
  "vars": {
    "first_name":       "{{contact.first_name}}",
    "full_name":        "{{contact.name}}",
    "business_name":    "{{location.name}}",
    "appointment_date": "{{appointment.start_date}}",
    "appointment_time": "{{appointment.start_time}}",
    "pipeline_stage":   "{{opportunity.pipeline_stage}}",
    "custom_service":   "{{contact.custom_field.servico}}"
  }
}
```

> **`event_type`** precisa bater com o `event_type` de um template **ativo** no painel.
> Em **`vars`**, use só variáveis da allow-list: `first_name, full_name, phone, email, business_name, user_name, appointment_date, appointment_time, pipeline_stage, custom_service`. Variáveis fora da lista são ignoradas na geração.

### 3. Capturar a resposta
A resposta do webhook é:

```json
{
  "generationId": "uuid",
  "audio_url": "https://.../spark-audio/<account>/<id>.mp3?token=...",
  "final_text": "Oi Ana, bem-vindo a Clínica Sol!"
}
```

No GHL, mapeie o campo de resposta **`audio_url`** para uma variável do workflow (Custom Values / Inbound Webhook mapping).

### 4. Enviar o áudio ao contato
Adicione a ação de envio (**Send WhatsApp / SMS / Email**) e use a variável do `audio_url`:
- **WhatsApp/SMS:** cole a URL como link do áudio (o GHL entrega como mídia/anexo) ou no corpo da mensagem.
- **E-mail:** insira como link ou player.

### 5. Testar
Use **Test Workflow** com um contato real. Confira no painel do Spark Voice AI, em **Audio History**, se a geração aparece com status `completed` e link do áudio.

## Erros comuns (retorno do webhook)

| HTTP | `error` | O que fazer |
|---|---|---|
| 401 | `invalid_secret` | Header `x-spark-webhook-secret` ausente/errado. |
| 404 | `account_not_found` | `location.id` não corresponde a uma conta instalada. |
| 403 | `account_inactive` | Conta suspensa/cancelada. |
| 404 | `no_template_for_event` | Não há template **ativo** para esse `event_type`. |
| 409 | `no_active_voice` / `voice_consent_missing` | Cadastre/ative uma voz com consentimento. |
| 422 | `content_policy_violation` | O texto final bateu na política de conteúdo. |
| 422 | `empty_final_text` | O template renderizou vazio (variáveis faltando). |
| 429 | `limit_exceeded` | Limite mensal de áudios/caracteres atingido. |
| 429 | `rate_limited` | Muitas chamadas por minuto para a mesma location. |
| 502 | `generation_failed` | Falha no TTS/storage — ver `Audio History` (status `failed`). |

A URL do áudio é **assinada e expira em 30 dias** (bucket privado). Para retenção maior, reenvie a mídia pelo canal no momento da geração.
