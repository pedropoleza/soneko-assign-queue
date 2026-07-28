# Prompt de kickoff — Cotação Leao (colar no Claude Code)

> Pré-requisito: `CLAUDE.md` na raiz do projeto. O Claude Code lê automaticamente.

---

Leia o `CLAUDE.md` na raiz por completo antes de começar — é a fonte de verdade sobre
domínio, dados, as duas APIs (CMS Marketplace e GHL) e as regras de negócio. Não
invente campos, endpoints ou regras fora dele.

Vamos construir a **fase 1 do Cotação Leao**: uma ferramenta que calcula estimativa de
cotação de seguro de saúde via API do CMS, deixa a corretora montar a proposta (campos
+ print) e gera uma página de aprovação para o cliente, tudo conectado ao GoHighLevel.

## Stack
Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query, Postgres
(Supabase ou Prisma). Toda chamada às APIs externas (CMS e GHL) é server-side via route
handlers — chave/token NUNCA no browser.

## Faça nesta ordem

1. **Scaffold + fundação**
   - Projeto Next.js App Router + TS + Tailwind + shadcn/ui + TanStack Query.
   - Camadas isoladas: `lib/cms/` (Marketplace API), `lib/ghl/` (GHL v2), `lib/db/`
     (schema + queries), `lib/types.ts` (tipos de domínio).
   - `.env.example` com todas as chaves do CLAUDE.md §2. Nunca commitar `.env.local`.
   - Schema do banco conforme §5 (quote, quote_option, quote_option_response).

2. **Integração CMS (`lib/cms/`)**
   - `client.ts`: wrapper server-side do `POST /plans/search` e `GET /plans/{id}`,
     com a key na query, tratamento de 429/rate limit e erro tipado.
   - Builder do `household` JSON a partir do input da Dani (pessoas+idades+gênero,
     income, place). Resolver `countyfips` a partir do zipcode.
   - Tipar a resposta (plano: prêmio, crédito, dedutível, max bolso, cost sharing).
   - Route handler `/api/quote/search` que o front chama (a key fica no servidor).

3. **Integração GHL (`lib/ghl/`)**
   - Auth server-side com refresh. Funções: buscar/atualizar contato, tags, mover
     stage de opportunity. Route handlers para as ações de escrita.

4. **Ponta A — a Dani monta a cotação (dentro do GHL)**
   - Tela para: selecionar contato → preencher household (form) → buscar planos (CMS)
     → escolher N opções → modelo **híbrido**: campos principais editáveis + **upload
     do print** (storage privado, §6) → gerar proposta com token e expiração.
   - Persistir tudo (quote + quote_options).

5. **Ponta B — página de proposta do cliente (link público com token)**
   - Rota pública `/proposta/[token]` com a marca Leao (§8): comparativo das opções
     **lado a lado**, cada uma com campos estruturados + print (zoom), badge de metal
     level, e o **aviso de estimativa** visível (§7, obrigatório).
   - Em cada opção: **Aprovar / Recusar** → grava `quote_option_response`, e dispara no
     GHL (tag `opcao_escolhida`, grava `plano_escolhido`, move stage, notifica a Dani).
   - Validar token e expiração; recusar link expirado com mensagem amigável.

6. **Qualidade**
   - Loading e erro em toda tela (CMS e GHL têm latência e rate limit).
   - Marca parametrizável (logo, cor, nome, aviso) — multi-tenant desde já.
   - README: setup, envs, como renovar a key do CMS (expira a cada 60 dias), como
     alternar ambiente.

## Regras que não podem ser violadas
- Chave do CMS e token do GHL só no servidor. Front chama nossos `/api/*`.
- A cotação é SEMPRE apresentada como **estimativa**, com prêmio bruto + estimado e o
  aviso visível (CLAUDE.md §7). Nunca como preço final garantido.
- Nada hardcoded (marca, location, corretora) — configurável para revenda.
- Print vai para storage privado com URL assinada e expiração; nunca é a fonte do dado.
- Camadas isoladas; front consome funções tipadas.

## Como trabalhar comigo
Antes de codar pesado, me mostre (a) o **schema do banco** e (b) a **estrutura de
pastas e o contrato das funções de `lib/cms/` e `lib/ghl/`**, e aguarde meu ok. Depois
execute por partes: fundação + CMS primeiro (é o coração), depois a Ponta A, depois a
página de proposta. Se algum campo do household ou endpoint do CMS/GHL divergir do que
está no CLAUDE.md, pare e me avise em vez de assumir — a doc oficial manda.
