# Spark Saúde — Dashboard da Corretora (Daniela Leão)

Contexto de projeto para o Claude Code. Leia este arquivo inteiro antes de gerar
qualquer código. Ele é a fonte de verdade sobre o domínio, os dados e as decisões
de arquitetura. Não invente campos, tags ou regras que não estejam aqui — se algo
faltar, pergunte antes de assumir.

---

## 1. O que é este projeto

Um dashboard embutido na conta GoHighLevel (GHL) da corretora Daniela Leão, que
trabalha com seguro de saúde (Obamacare / Marketplace) e seguro de vida. O
dashboard roda como uma página conectada via **Custom Menu Link** dentro do GHL e
consome a **API v2 do GHL** para ler e escrever dados reais da conta (location).

O objetivo é dar à Dani uma visão operacional que o GHL nativo não entrega bem:
carteira de clientes, renovações, status de aplicações e material do dia a dia,
tudo numa interface limpa que parece parte do próprio GHL.

**Este projeto começa pelo dashboard.** Não é o app de cotação (que depende da API
do Marketplace/CMS e fica fora do escopo). É a camada de visualização e gestão em
cima dos dados que já existem na conta.

### Princípio de produto: configurável para revenda

A Dani é o cliente-piloto, mas o objetivo é revender isso para outros corretores
do ecossistema (Five Rings Financial). Portanto:

- **Nada de valores chumbados no código.** Location ID, nomes de pipeline, IDs de
  custom field, logo, cores — tudo vem de configuração/env, nunca hardcoded.
- A camada de dados (`lib/ghl/`) deve ser trocável: hoje lê da API do GHL, amanhã
  pode ler de outra fonte sem reescrever o front.
- Pense em "multi-tenant desde o início", mesmo que a V1 rode só para uma location.

---

## 2. Stack e decisões de arquitetura

- **Next.js (App Router) + TypeScript** — necessário porque o OAuth e o token do
  GHL NÃO podem viver no browser. Toda chamada à API do GHL passa por **route
  handlers server-side** (`app/api/.../route.ts`). O front nunca vê o access token.
- **Tailwind CSS** para estilo, com design tokens que replicam a estética do GHL
  (ver seção 6).
- **shadcn/ui** para componentes base (tabs, table, card, badge), customizados
  para a aparência GHL.
- **TanStack Query** (react-query) para cache e estados de loading/error das
  chamadas de dados.
- **Camada de dados isolada em `lib/ghl/`** — um client tipado da API do GHL. O
  front consome funções desse módulo, nunca faz fetch direto. Isso é o que torna a
  fonte de dados trocável para a revenda.

### Fluxo de autenticação (importante)

- A conexão com o GHL é via **OAuth 2.0** (Marketplace App do GHL) OU via
  **Private Integration Token (PIT)**. O token de acesso e o refresh token ficam
  **só no servidor** (env vars / storage server-side).
- Todo request do dashboard para dados do GHL: front chama `/api/...` (nosso
  route handler) → route handler usa o token do servidor → chama a API do GHL →
  devolve só o necessário pro front.
- Tokens OAuth do GHL expiram e precisam de refresh. Implementado refresh
  automático no client server-side (`lib/ghl/auth.ts`), com retry transparente em
  401. PITs não expiram (usados no piloto).

### Variáveis de ambiente esperadas (`.env.local`)

```
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_ACCESS_TOKEN=          # PIT "pit-..." ou access token OAuth
GHL_REFRESH_TOKEN=
GHL_LOCATION_ID=           # a location da Dani (configurável, não hardcode)
GHL_API_BASE=https://services.leadconnectorhq.com
GHL_API_VERSION=2021-07-28 # header Version exigido pela API v2 do GHL
```

Nunca commite `.env.local`. Há um `.env.example` com as chaves vazias.

---

## 3. Domínio: as duas linhas e as duas pipelines

A conta atende duas linhas de produto, separadas por tag no contato:

- `linha_saude` — seguro de saúde (Obamacare/Marketplace). Foco deste dashboard.
- `linha_vida` — seguro de vida (já roda no plano Growth existente, não mexer).

A jornada de saúde é dividida em **duas pipelines** com um stage-ponte entre elas:

### Pipeline 1 — Aquisição (do lead ao fechamento)

1. Novo lead
2. Cotação solicitada
3. Cotação enviada
4. Opção escolhida → Aplicação
5. Aguardando aprovação
6. Informação pendente
7. Aprovado
8. Fechado → transferir  *(stage-ponte de saída)*

### Pipeline 2 — Cliente (gestão e renovação)

1. Onboarding / Entrada  *(stage-ponte de entrada)*
2. Cliente ativo
3. Renovação pendente
4. Renovação feita
5. Revisão / mudança de plano
6. Cliente inativo

O corte entre as pipelines é em **cliente ativo** (pagamento/vigência confirmados).
A P1 é a captação; a P2 é o ciclo de vida do cliente.

---

## 4. Mapa de dados: custom fields (GHL)

Padrão de nomenclatura: `snake_case` em português. Os IDs reais dos custom fields
vêm da API (`GET locations/{id}/customFields`) — **busque os IDs dinamicamente pelo
`fieldKey`/nome, não hardcode**. Ver o **Apêndice A** para as chaves reais da conta
(o GHL mangla os acentos das chaves).

### Custom fields do CONTATO — folders `Saude - Cotacao / Aplicacao / Apolice / Renovacao`

Campos-chave: `pessoas_na_casa`, `pessoas_no_seguro`, `renda_casa`, `idioma`,
`data_nascimento`, `documentacao_recebida`, `plano_escolhido`, `seguradora`,
`valido_a_partir`, `data_renovacao`, `forma_pagamento`, `mudou_renda`,
`mudou_endereco`, `mudou_dependentes`, `intencao_renovar`, `motivo_nao_renovar`.

> `data_renovacao` é o campo-chave do ciclo de renovação. É por ele que o
> dashboard calcula "quem renova nos próximos 30/60/90 dias".
>
> Documentos (SSN, passaporte, comprovantes) NÃO são custom field. Ficam na aba
> **Documents** nativa do contato. `documentacao_recebida` é só o status.

### Custom fields da OPPORTUNITY / negócio

`valor_mensal` (prêmio mensal) e `origem_negocio`.

> **Divergência na conta real:** o prêmio mensal está no CONTATO como
> `monthly_premium` (NUMERICAL), não na Opportunity. Ver Apêndice A.

---

## 5. Mapa de dados: tags (GHL)

- **Linha:** `linha_saude`, `linha_vida`
- **Origem:** `origem_indicacao`, `origem_whatsapp`, `origem_organica`
- **P1 — cotação:** `lead_novo`, `cotacao_solicitada`, `cotacao_enviada`, `opcao_escolhida`
- **P1 — aplicação:** `aplicacao_iniciada`, `aplicacao_em_analise`, `informacao_pendente`, `aprovado`, `pagamento_confirmado`
- **P2 — ciclo do cliente:** `cliente_onboarding`, `cliente_ativo`, `cliente_inativo`
- **P2 — renovação:** `renovacao_avisada`, `renovacao_pendente`, `renovacao_feita`, `nao_renovou`, `em_revisao`
- **Operacionais:** `form_nao_preenchido`, `lembrete_enviado`, `sem_resposta`, `requer_atencao`, `documento_pendente`

---

## 6. Design: alinhado ao GoHighLevel

- **Navegação por abas SUPERIORES** (top tabs horizontais). Nada de sidebar.
- **Sem títulos com ícones.** Títulos de seção são texto limpo. Ícones só quando
  funcionais (ex.: ação num botão), nunca como enfeite de heading.
- Estética GHL: fundo claro (`#F9FAFB`/branco), cards com borda sutil, azul
  primário (`#2A6FF3`/`#155EEF`), tipografia system/Inter, densidade alta.
- Tabelas limpas, hover nas linhas, status em badges de cor suave.
- Priorize desktop.

### Abas do dashboard (V1)

1. **Visão geral** — cards de resumo + lista "precisa de atenção".
2. **Renovações** — a mais importante. Lista por `data_renovacao`, filtros
   30/60/90 dias, status colorido, ação rápida.
3. **Pipeline** — os dois funis, contagem por stage, colunas montadas
   dinamicamente pela definição da API.
4. **Clientes** — busca/listagem `linha_saude` paginada + "cliente 360".

---

## 7. O que o dashboard lê e escreve na API do GHL

### Leitura

- Contatos por tag `linha_saude` (paginação).
- Custom fields por contato (resolução `fieldKey → id`).
- Opportunities por pipeline/stage.
- Definições de pipeline/stage (colunas dinâmicas).

### Escrita (ações rápidas, sempre com confirmação no front)

- Adicionar/remover tags de um contato.
- Atualizar custom field.
- Mover opportunity de stage.

### Endpoints v2 relevantes (base `services.leadconnectorhq.com`, header `Version: 2021-07-28`)

- `POST /contacts/search` — listar/filtrar por tag (paginação por `searchAfter`).
- `GET /contacts/{id}` / `PUT /contacts/{id}` — detalhe / atualizar custom field.
- `POST` e `DELETE /contacts/{id}/tags` — tags.
- `GET /opportunities/search` — opportunities (params snake_case: `location_id`, `pipeline_id`).
- `PUT /opportunities/{id}` — mover stage.
- `GET /locations/{id}/customFields` — resolver fieldKey → id.
- `GET /opportunities/pipelines` — definições de pipeline/stage.

---

## 8. Regras de implementação (guardrails)

- **Sem token no browser.** Toda credencial e chamada externa é server-side.
- **Sem hardcode** de location, IDs de campo, nomes de pipeline.
- **Camada de dados isolada** em `lib/ghl/`.
- **Tipar tudo.** Tipos do domínio em `lib/types.ts`.
- **Tratar loading e erro** em toda tela.
- **Paginação real** nas listagens.
- Modo de desenvolvimento com fixtures em `lib/ghl/__fixtures__/`
  (`GHL_USE_FIXTURES=true`). O caminho final é a API real.
- Commits pequenos e descritivos. Sem segredos no repositório.

---

## 9. Fora do escopo desta V1

- Cotação automática via API do Marketplace/CMS.
- Envio de WhatsApp pelo dashboard.
- Módulo de aplicação assistida e central de seguradoras (V2).
- Multi-idioma da interface (a Dani usa em PT).

---

## Apêndice A — Achados da conta real (location `Daniela Leão`)

Descobertos via API v2 ao conectar o piloto. Os semantic keys do app mapeiam para
estas `fieldKey` reais via `spark_saude.tenants.config.fieldMap` (Supabase).

**Custom fields (o GHL removeu acentos das chaves de forma irregular):**

| Semântico (app)        | fieldKey real na conta        | Tipo           |
|------------------------|-------------------------------|----------------|
| `dataRenovacao` ★      | `contact.data_renovao`        | DATE           |
| `validoAPartir`        | `contact.valido_a_partir_de`  | DATE           |
| `formaPagamento`       | `contact.forma_de_pagamento`  | SINGLE_OPTIONS |
| `documentacaoRecebida` | `contact.documentao_recebida` | SINGLE_OPTIONS |
| `intencaoRenovar`      | `contact.inteno_renovar`      | SINGLE_OPTIONS |
| `beneficiario`         | `contact.beneficirio`         | TEXT           |
| `motivoNaoRenovar`     | `contact.motivo_no_renovar`   | TEXT           |
| `mudouEndereco`        | `contact.mudou_endereo`       | RADIO          |
| `monthlyPremium`       | `contact.monthly_premium`     | NUMERICAL      |
| `seguradora`           | `contact.seguradora`          | SINGLE_OPTIONS |
| `planoEscolhido`       | `contact.plano_escolhido`     | TEXT           |

Extras presentes: `underwriting_status`, `policy_start_date`,
`next_policy_anniversary`, `next_followup`, `main_objection`,
`submitted_proposal`, `primary_beneficiary`.

**Pipelines (nomes em inglês, montadas dinamicamente):**

- `1. Acquisition` (`ZtTF1wN5uquH5eS1EFog`) — New lead, Quote requested,
  Automatic Follow-up, Quote sent, Option chosen → Application, Awaiting approval,
  Info pending, Approved.
- `2. Client` (`sSuVCvpsB2O3xkmu0ZPy`) — New Client, Client active, Renewal
  pending, Renewal done, Review / plan change, Client inactive.

Stage de renovação: **Renewal pending** (`86fc60fe-5df8-4949-9d8c-07e4c4fbea54`).

**Storage:** schema Supabase isolado `spark_saude` (tabelas `tenants`,
`ghl_tokens`) acessado por RPCs `SECURITY DEFINER` no `public`, só via
`service_role`. Nada compartilhado com outros projetos.
