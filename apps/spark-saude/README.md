# Spark Saúde — Dashboard da Corretora

Dashboard operacional de seguro saúde (Obamacare/Marketplace) embutido no
GoHighLevel via **Custom Menu Link**. Lê e escreve dados reais da conta pela
**API v2 do GHL**, com o token **sempre no servidor** (nunca no browser).

> A fonte de verdade do domínio/design está em [`CLAUDE.md`](./CLAUDE.md).

## Stack

- **Next.js (App Router) + TypeScript** — route handlers server-side falam com o GHL.
- **Tailwind + shadcn-style UI** — design tokens alinhados ao GHL (abas superiores, sem sidebar).
- **TanStack Query** — cache e estados de loading/erro.
- **Supabase** (schema isolado `spark_saude`) — armazena token e config por location.

## Arquitetura (camadas)

```
Browser  ──►  /api/*  (route handlers)  ──►  lib/ghl/*  ──►  GHL API v2
                          │
                          └► lib/supabase (RPCs)  ──►  spark_saude.{tenants,ghl_tokens}
```

- O front (`components/`, `app/(dashboard)/`) só chama `/api/*` via `lib/client/api.ts`.
- **Nunca** faz fetch direto ao GHL. Toda a lógica de dados vive em `lib/ghl/`.
- `lib/ghl/auth.ts` resolve o token (PIT ou OAuth com refresh) a partir de um
  `TokenStore` trocável (Supabase por padrão; memória/env como fallback).
- `fieldKey → id` é resolvido dinamicamente (`lib/ghl/customFields.ts`); nada de IDs hardcoded.

## Rodando localmente

```bash
cd apps/spark-saude
cp .env.example .env.local   # preencha as chaves
npm install
npm run dev                  # http://localhost:3100
```

### Variáveis de ambiente

Veja `.env.example`. As principais:

| Variável | Para quê |
|---|---|
| `GHL_ACCESS_TOKEN` | PIT (`pit-...`) ou access token OAuth. **Secreto.** |
| `GHL_LOCATION_ID` | Location atendida (configurável, sem hardcode). |
| `GHL_API_BASE` / `GHL_API_VERSION` | Base e header `Version` da API v2. |
| `GHL_CLIENT_ID` / `GHL_CLIENT_SECRET` / `GHL_REFRESH_TOKEN` | Só para o fluxo OAuth (refresh). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Store de token/config. **Service key é secreta, server-only.** |
| `GHL_USE_FIXTURES` | `true` = fixtures (dev), `false` = API real. |
| `ALLOWED_FRAME_ANCESTORS` | Allow-list CSP para embutir em domínios GHL/white-label. |

## Fixtures × API real

O dashboard tem um modo de desenvolvimento com dados realistas em
`lib/ghl/__fixtures__/`, para construir/ajustar o layout sem bater na API:

```bash
# .env.local
GHL_USE_FIXTURES=true    # serve fixtures (nenhuma chamada ao GHL)
GHL_USE_FIXTURES=false   # caminho final: API real do GHL
```

O switch é aplicado no facade `lib/ghl/index.ts` (o único módulo que os route
handlers consomem). Escritas em modo fixtures são no-ops simuladas.

## Embutir no GoHighLevel (Custom Menu Link)

1. Faça deploy (ex.: Vercel) e configure as variáveis de ambiente lá.
2. No GHL: **Settings → Custom Menu Links** → aponte para a URL pública do app.
3. O app já envia `Content-Security-Policy: frame-ancestors …` liberando os
   domínios do GHL (e white-label via `ALLOWED_FRAME_ANCESTORS`), então carrega
   dentro do iframe do GHL sem `X-Frame-Options` bloqueando.

## Rotas de API

| Rota | Método | Ação |
|---|---|---|
| `/api/overview` | GET | Métricas + lista "precisa de atenção". |
| `/api/renewals?within=30\|60\|90` | GET | Renovações na janela. |
| `/api/pipeline` | GET | Os dois funis com contagem por stage. |
| `/api/contacts?q=&cursor=&limit=` | GET | Lista `linha_saude` paginada / busca. |
| `/api/contacts/{id}` | GET | Detalhe (cliente 360). |
| `/api/contacts/{id}/tags` | POST / DELETE | Adiciona / remove tags. |
| `/api/contacts/{id}/field` | PUT | Atualiza um custom field. |
| `/api/opportunities/{id}/stage` | PUT | Move opportunity de stage. |

Todas as escritas validam o input (`zod`) e exigem confirmação no front.

## Scripts

```bash
npm run dev        # dev server (porta 3100)
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
```
