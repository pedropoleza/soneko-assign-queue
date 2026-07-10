# Runbook operacional — Spark Voice AI

Guia de diagnóstico e operação. Projeto Supabase: **GHL Token** (`tbziahcpkrfiksqhuhpe`), schema `spark`.

## Arquitetura em uma frase
Workflow do GHL → `spark-ghl-webhook` (valida secret, resolve conta pela location, checa status/limite, renderiza template, aplica política, chama ElevenLabs, salva MP3 no bucket privado, grava `audio_generations` + `usage_logs`) → devolve `audio_url`.

## Secrets das Edge Functions
Dashboard → Edge Functions → Secrets (projeto GHL Token):
`SPARK_SESSION_SECRET`, `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_OAUTH_REDIRECT_URI`, `GHL_WEBHOOK_SECRET`, `ELEVENLABS_API_KEY`, `APP_URL`, `DEFAULT_MONTHLY_AUDIO_LIMIT`, `DEFAULT_MONTHLY_CHARACTER_LIMIT`. Opcional dev: `SPARK_TTS_MOCK=1`. (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` são automáticos.)

> **Durabilidade do schema:** o schema `spark` está exposto no PostgREST via `ALTER ROLE authenticator SET pgrst.db_schemas`. Se algum dia as tabelas `spark.*` derem `PGRST205 (not found in schema cache)`, rode: `notify pgrst, 'reload schema';`. Para garantir persistência, adicione `spark` em **Settings → API → Exposed schemas**.

## Diagnóstico rápido

**Geração falhou (status `failed`)** — buscar a causa:
```sql
select id, event_type, status, left(error_message,120) as err, created_at
from spark.audio_generations
where status = 'failed'
order by created_at desc limit 20;
```
- `elevenlabs_key_missing` → setar `ELEVENLABS_API_KEY` (ou `SPARK_TTS_MOCK=1` em dev).
- `elevenlabs_tts_*` / `elevenlabs_clone_*` → erro da API ElevenLabs (crédito, voz inválida, rate).
- `storage_upload` / `storage_sign` → bucket `spark-audio` ausente/sem permissão.

**Webhook retornando erro** — ver tabela em `docs/ghl-workflow.md`. Logs: Dashboard → Edge Functions → `spark-ghl-webhook` → Logs (ou MCP `get_logs`).

## Operações comuns

**Excluir/ trocar a voz de uma conta** (ex.: pedido de remoção):
```sql
delete from spark.voices where account_id = '<account_id>';
```

**Resetar/ajustar uso** — o uso é derivado de `audio_generations` (status `completed`) do mês corrente. Para “zerar” um mês de teste:
```sql
delete from spark.audio_generations where account_id = '<account_id>' and is_test = true;
```

**Suspender uma conta (bloqueia geração):**
```sql
update spark.accounts set status = 'suspended' where ghl_location_id = '<location_id>';
```

**Ajustar limites de plano:**
```sql
update spark.accounts
set plan='growth', monthly_audio_limit=500, monthly_character_limit=100000
where ghl_location_id = '<location_id>';
```

## Rollback (falha crítica)
1. Reverter a function para a versão anterior (Dashboard → Edge Functions → versão) ou redeploy do commit estável.
2. Desativar o secret do webhook no workflow do GHL (interrompe novas gerações).
3. Se custo descontrolado no ElevenLabs: pausar/rotacionar `ELEVENLABS_API_KEY`.
4. Investigar em `audio_generations` (status `failed`) e nos logs.

## Glossário
- **Conta ativa:** `accounts.status = 'active'`. Só ativa gera áudio.
- **Voz ativa:** uma por conta, `status='active'` + `consent_accepted=true`.
- **Geração concluída:** `status='completed'` com `audio_url` e registro em `usage_logs`.
- **Limite mensal:** áudios/caracteres `completed` no mês corrente ≥ limite do plano.
