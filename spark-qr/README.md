# Spark QR ⚡️

Gerador de **QR dinâmico** com slug customizável, redirect editável e analytics de scan. Single-tenant.

O pulo do gato: o QR codifica só o **slug** (`qr.sparkleads.com/{slug}`). O destino (`target_url`) é editável a qualquer momento — troca o destino **sem reimprimir o QR**.

## Arquitetura

```
Painel (este app) ──cria/edita──► Edge Function spark-qr-admin ──► Supabase (schema qr)
                                                                         │
Celular escaneia ──► qr.sparkleads.com/{slug} ──► Edge Function spark-qr-redirect
                                                     │ 1. lookup do slug
                                                     │ 2. 302 redirect (hot path)
                                                     └ 3. registra scan (fire-and-forget)
```

- **Backend** — Supabase, projeto `GHL Token` (`tbziahcpkrfiksqhuhpe`), schema isolado `qr`.
  - Tabelas: `qr.qr_codes`, `qr.qr_scans`, `qr.app_config`, `qr.reserved_slugs`.
  - Acesso só via RPCs `public.spark_qr_*` (SECURITY DEFINER, gated por secret) — o schema `qr` nunca é exposto no PostgREST.
  - Edge Function `spark-qr-redirect` (pública) — o núcleo do redirect.
  - Edge Function `spark-qr-admin` (gated por `x-spark-secret`) — CRUD + analytics.
- **Frontend** — este app Vite + React + Tailwind (separado do painel soneko).

## Privacidade / performance

- IP **nunca** é armazenado cru: é hasheado (`sha256(ip + salt)`) dentro do Postgres; o salt nunca sai do banco.
- O insert do scan é **fire-and-forget** (`EdgeRuntime.waitUntil`) — o 302 não espera o registro, então um insert lento nunca atrasa o redirect.
- Geo (`country`/`city`) vem dos headers do CDN que fronteia o domínio (`x-vercel-ip-country`, `cf-ipcountry`, …). Sem CDN geo, ficam nulos — o resto funciona normalmente.

## Rodando localmente

```bash
cd spark-qr
npm install
cp .env.example .env   # ajuste as URLs/secret se precisar
npm run dev            # http://localhost:5174/?secret=<admin secret>
```

Pegue o admin secret gerado na migration:

```sql
select public.spark_qr_config();   -- { "admin_secret": "..." }
```

O secret entra via `?secret=...` (salvo em localStorage) ou na tela de login.

## Deploy

1. **Banco** — migration em `../supabase/migrations/0001_spark_qr.sql` (já aplicada no projeto `GHL Token`).
2. **Edge Functions** — `../supabase/functions/spark-qr-redirect` e `../spark-qr-admin` (deploy via Supabase CLI/MCP, ambas com `verify_jwt = false`).
3. **Frontend** — `npm run build` → publique `dist/` (Vercel/Netlify/estático). Configure as envs:
   - `VITE_SPARK_QR_API` — URL da function admin.
   - `VITE_QR_PUBLIC_BASE` — `https://qr.sparkleads.com` quando o DNS estiver pronto.
4. **DNS (time)** — apontar `qr.sparkleads.com/{slug}` para a function de redirect. Opções:
   - Reverse proxy / rewrite (Vercel/Cloudflare): `qr.sparkleads.com/*` → `…/functions/v1/spark-qr-redirect/*` (de quebra o CDN injeta os headers de geo).
   - Ou Supabase Custom Domain apontando para a function.

   A function lê o slug do **último segmento do path**, então funciona tanto em `/{slug}` quanto em `/functions/v1/spark-qr-redirect/{slug}`.

## Slugs reservados

`api`, `admin`, `_next`, `favicon`, `dashboard`, `auth`, … (lista completa em `qr.reserved_slugs`). Validação na criação: regex `^[a-z0-9][a-z0-9-]{1,49}$`, lowercase, sem reservados, sem colisão (unique constraint).
