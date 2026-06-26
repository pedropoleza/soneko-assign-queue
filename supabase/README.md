# Supabase — Spark QR

Artefatos versionados do backend do Spark QR (projeto `GHL Token`, ref `tbziahcpkrfiksqhuhpe`).

```
supabase/
  migrations/
    0001_spark_qr.sql            # schema qr + RPCs public.spark_qr_* (já aplicada)
  functions/
    spark-qr-redirect/index.ts   # redirect público {slug} -> 302 + scan (verify_jwt=false)
    spark-qr-admin/index.ts       # CRUD + analytics, gated por x-spark-secret (verify_jwt=false)
```

## Aplicar / fazer deploy

```bash
# Migration
supabase db push   # ou aplique 0001_spark_qr.sql no SQL editor

# Functions (ambas SEM verify_jwt)
supabase functions deploy spark-qr-redirect --no-verify-jwt
supabase functions deploy spark-qr-admin   --no-verify-jwt
```

> As duas usam `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (injetadas automaticamente no runtime das Edge Functions). Nenhum segredo extra precisa ser configurado: o admin secret e o salt de hash vivem em `qr.app_config` (auto-gerados pela migration).

Pegue o admin secret:

```sql
select public.spark_qr_config();
```
