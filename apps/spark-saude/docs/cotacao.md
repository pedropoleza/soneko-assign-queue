# Cotação Leao — Produto de Cotação e Proposta (Daniela Leão)

Contexto de projeto para o Claude Code. Leia este arquivo inteiro antes de gerar
qualquer código. É a fonte de verdade sobre domínio, dados, API e regras. Não invente
campos, endpoints ou regras que não estejam aqui — se faltar algo, pergunte.

---

## 1. O que é este produto

Uma ferramenta que absorve o processo manual de cotação da corretora Daniela Leão
(Leao Insurances) e o transforma em produto. Hoje ela cota seguro de saúde
(Obamacare/Marketplace) na mão, tira prints das telas e manda solto no WhatsApp pro
cliente aprovar. Este produto:

1. **Calcula a estimativa de cotação** via API oficial do CMS (a mesma que roda o
   HealthCare.gov), a partir do perfil da família.
2. **Deixa a Dani montar a cotação** com os planos (dados estruturados + print anexo
   como respaldo).
3. **Gera uma página de proposta** com a marca Leao, onde o cliente vê as opções lado
   a lado e **aprova ou recusa cada uma**.
4. **Armazena tudo** — cotações, opções de plano, e a decisão do cliente — e conecta
   ao GoHighLevel (CRM) da conta.

Roda embutido no GHL via Custom Menu Link, e a página de proposta do cliente é um
link público com token.

### Caso real que o produto reproduz (exemplo da própria Dani)

> "Cotações para seguro saúde do Marketplace/Obamacare para 2026: Família de 4
> pessoas (Masc 49 e 17 anos, Fem 57 e 19 anos), Zipcode 33073, renda familiar anual
> estimada de $33,000. Quando fizermos o seguro provavelmente o valor ficará menor,
> pois durante a cotação o sistema não reconhece as idades das crianças."

Esse texto é o input do produto: household (4 pessoas com idades), place (zipcode),
income. E a ressalva dela sobre "valor pode ficar menor" é regra de negócio — ver §7.

---

## 2. Stack e arquitetura

- **Next.js (App Router) + TypeScript** — necessário porque a **API key do CMS e o
  token do GHL NÃO podem viver no browser**. Toda chamada externa passa por route
  handlers server-side (`app/api/.../route.ts`).
- **Tailwind CSS** + **shadcn/ui**, com design tokens da marca Leao (§8).
- **Banco de dados** para persistir cotações/opções/decisões. Use **Postgres via
  Supabase** (ou Prisma + Postgres). Modele em `lib/db/schema`.
- **TanStack Query** para estados de dados no front.
- **Camada de integração isolada**: `lib/cms/` (API do Marketplace) e `lib/ghl/`
  (API do GHL). O front nunca chama esses serviços direto.

### Princípio de produto: configurável para revenda

A Dani é cliente-piloto; o objetivo é revender pra outros corretores de saúde
(ecossistema Five Rings). Portanto: **nada hardcoded** (logo, cores, location GHL,
dados da corretora vêm de config), multi-tenant desde o início, e a marca é
parametrizável (§8).

### Variáveis de ambiente (`.env.local`, com `.env.example` vazio no repo)

```
# CMS Marketplace API
CMS_MARKETPLACE_API_KEY=          # solicitar em developer.cms.gov/marketplace-api/key-request
CMS_API_BASE=https://marketplace.api.healthcare.gov/api/v1

# GoHighLevel API v2
GHL_ACCESS_TOKEN=
GHL_REFRESH_TOKEN=
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_LOCATION_ID=
GHL_API_BASE=https://services.leadconnectorhq.com
GHL_API_VERSION=2021-07-28

# Banco
DATABASE_URL=

# App
NEXT_PUBLIC_APP_URL=
PROPOSAL_TOKEN_SECRET=            # assinar tokens dos links de proposta
```

> **Atenção operacional:** a API key do CMS **expira a cada 60 dias** e uma nova chega
> por e-mail automaticamente. Implemente a leitura da key de forma que trocar seja só
> atualizar a env (ou um pequeno storage), sem redeploy de código. Documente isso no
> README.

---

## 3. A API do CMS Marketplace (núcleo da cotação)

Base: `https://marketplace.api.healthcare.gov/api/v1`. Autenticação por `apikey` na
query string. Rate limited (o limite volta no header — respeite e trate 429).

### Endpoint principal — buscar planos com estimativa de preço/subsídio

`POST /plans/search?apikey={KEY}` — body JSON com `household`, `market`, `place`,
`year`. Retorna os planos disponíveis com prêmio e estimativa de crédito fiscal (APTC).

Exemplo de request (estrutura real da API):
```json
{
  "household": {
    "income": 33000,
    "people": [
      { "age": 49, "gender": "Male",   "aptc_eligible": true, "uses_tobacco": false, "relationship": "Self" },
      { "age": 57, "gender": "Female", "aptc_eligible": true, "uses_tobacco": false, "relationship": "Spouse" },
      { "age": 17, "gender": "Male",   "aptc_eligible": true, "uses_tobacco": false, "relationship": "Child" },
      { "age": 19, "gender": "Female", "aptc_eligible": true, "uses_tobacco": false, "relationship": "Child" }
    ]
  },
  "market": "Individual",
  "place": { "zipcode": "33073", "state": "FL", "countyfips": "12011" },
  "year": 2026
}
```

Campos importantes do household (confirmar todos na doc oficial antes de implementar):
- `income` — renda anual estimada da família.
- `people[]` — cada pessoa com `age`, `gender`, `aptc_eligible`, `uses_tobacco`, e
  opcionalmente `relationship` (Self, Spouse, Child…). Passar `relationship` melhora a
  precisão da elegibilidade.
- `place` — `zipcode` + `state` + `countyfips`. Se não tiver o countyfips, resolver
  pelo zipcode (a API tem endpoint de counties por zip; ou usar tabela FIPS local).

### Outros endpoints úteis
- `GET /plans/{planId}?year={year}&apikey={KEY}` — detalhe granular do plano
  (issuer, cost sharing, deductibles, dependentes elegíveis, rating).
- Endpoint de counties por ZIP — para resolver `countyfips` a partir do zipcode.
- Drug/provider coverage — fora do escopo da fase 1.

### Regras de uso
- **Toda chamada ao CMS é server-side** (route handler). A key nunca vai ao browser.
- A API é para **acesso ao vivo**, não para scraping/extração de dataset inteiro.
- Só cobre estados no HealthCare.gov federal (~30 estados). Estados com marketplace
  próprio (CA, NY, etc.) NÃO são cobertos. A Dani atua na **Flórida (FL)**, que é
  federal — ok. Mas deixe o `state` parametrizado e trate o caso "estado não coberto".

---

## 4. Fluxo do produto (as duas pontas)

### Ponta A — a Dani monta a cotação (dentro do GHL)
1. Seleciona/cria o contato (puxa nome e dados da carteira via GHL).
2. Preenche o **perfil da cotação**: household (pessoas + idades + gênero), zipcode,
   renda anual estimada, ano, tabaco.
3. O produto chama a API do CMS e lista os planos disponíveis com preço estimado.
4. A Dani **escolhe as opções** que quer propor (ex.: 2 ou 3 planos), podendo:
   - Editar/ajustar campos principais (modelo híbrido — ver §5).
   - **Anexar o print** daquele plano como respaldo visual.
5. Escolhe o **idioma do cliente** (padrão Português BR; também Español e English).
   O idioma vale para o que o cliente recebe — mensagem, e-mail e PDF. A tela da
   corretora segue sempre em português.
6. Gera a proposta → link único pro cliente.
7. **Entrega**: envia por WhatsApp, por e-mail, ou **pelos dois de uma vez** (cada
   canal responde separado — a falha de um não derruba o outro), e/ou gera o PDF da
   proposta sem enviar. As mesmas ações existem na tela de montar e na do
   Marketplace.

### Ponta B — o cliente recebe a proposta (link público)
1. Abre o link com a marca Leao (logo, navy).
2. Vê as opções de plano **lado a lado** (comparativo limpo), cada uma com os campos
   estruturados + o print anexo (zoom ao clicar).
3. A ressalva de estimativa aparece visível (§7).
4. Em cada opção: botão **Aprovar** ou **Recusar**.
5. A decisão volta pro GHL (tag + move stage + notifica a Dani) e fica registrada no
   banco com data/hora.

---

## 5. Modelo de dados (persistência)

Modele estas entidades (Postgres). Nomes de campo em snake_case.

**quote** (a cotação)
- `id`, `ghl_contact_id`, `corretora_id` (multi-tenant), `created_at`
- `household_json` (o household enviado ao CMS), `zipcode`, `state`, `countyfips`,
  `income`, `year`
- `status` (rascunho / enviada / respondida)
- `proposal_token` (para o link público), `token_expires_at`

**quote_option** (cada plano proposto dentro de uma cotação)
- `id`, `quote_id`
- Campos estruturados (a "ficha do plano", vindos da API e/ou editados pela Dani):
  `plan_id` (o ID do CMS), `seguradora`, `nome_plano`, `metal_level`,
  `premio_mensal`, `premio_sem_credito`, `credito_fiscal`, `dedutivel`,
  `max_bolso`, `atencao_primaria`, `atencao_especialista`, `atencao_urgencia`,
  `emergencia`, `saude_mental`, `medicamento_generico`
- `print_url` (o print anexo, ver §6)
- `fonte` ("api" se veio do CMS, "manual" se a Dani digitou/ajustou)

**quote_option_response** (a decisão do cliente)
- `id`, `quote_option_id`, `decisao` (aprovado / recusado), `comentario`,
  `respondido_em`, `ip_hash` (auditoria leve)

> Os campos estruturados espelham exatamente o que aparece nos prints da Oscar:
> prêmio, prêmio antes do crédito, crédito fiscal, dedutível, máximo do bolso, e a
> tabela "Usted paga" (primária, especialista, urgência, emergência, saúde mental,
> genéricos). Use esses campos como o schema da ficha do plano.

---

## 6. Upload de print (modelo híbrido)

- A Dani anexa o print de cada plano como respaldo visual. Upload vai para storage
  (Supabase Storage ou S3), NÃO para custom field do GHL.
- O print é **complemento**, não a fonte: os dados estruturados (§5) é que alimentam
  a comparação e ficam pesquisáveis. O print dá a confiança da "tela oficial".
- **Privacidade:** prints contêm dado sensível (nome, renda, às vezes parte de SSN).
  Storage privado, URL assinada com expiração, sem indexação. O link da proposta usa
  token assinado e **expira** (default 30 dias, configurável).

---

## 7. Regra de negócio central: é ESTIMATIVA, não valor final

Isto é inegociável e vem da própria operação da Dani. A cotação (dela ou da API) é
uma **estimativa**, nunca o valor final vinculante. Motivos: o subsídio (APTC) é
calculado sobre renda e household estimados e reconciliado na declaração de imposto; e
o próprio sistema pode não reconhecer idades de dependentes na cotação (ela mesma diz
que "o valor provavelmente ficará menor").

Portanto o produto DEVE:
- Mostrar sempre o **prêmio bruto** (sólido) junto do **estimado com crédito**
  (estimativa). Espelha os prints: "$0.00/mês — Incluye el $3,135 del crédito fiscal —
  estaba $3,087.47".
- Exibir um **aviso de estimativa** claro e visível na proposta (não escondido). Algo
  como: "Valores estimados com base nas informações informadas. O valor final é
  confirmado na aplicação oficial e pode ser menor." Texto configurável.
- **Datar** a cotação ("estimativa gerada em [data]") — a regra de subsídio em 2026
  está em mudança (a expansão do PTC acima de 400% do FPL estava marcada para expirar
  em 31/12/2025), então saber quando foi gerada importa.

NUNCA apresentar o número como preço garantido. O produto vende clareza e rapidez, não
exatidão absoluta.

---

## 8. Design: marca Leao Insurances

Identidade (do logo): escudo com família, tipografia "LEAO", tagline "YOUR FUTURE.
OUR PROTECTION."

- **Navy** `#1B2A4A` (primária), **Navy deep** `#14203A`, **Steel** `#8A8D91`
  (secundária), **Mist** `#F4F6F9` (fundo), branco.
- Tipografia: Inter / system-ui; títulos podem usar Outfit.
- Visual **profissional e limpo**, tema claro (o logo é escuro sobre claro).
- A **página de proposta do cliente** é a vitrine: tem que parecer material premium de
  corretora, não print solto. Comparativo lado a lado, cards com borda sutil, badges de
  metal level (Silver/Gold) em cor suave.
- Tudo parametrizável por corretora (logo, cor primária, nome, tagline, aviso legal) —
  para revenda.

---

## 9. Conexão com o GoHighLevel

Reaproveita a estrutura já definida na conta (mesmos nomes):
- Ao **enviar** a proposta: contato ganha tag `cotacao_enviada`, opportunity vai para o
  stage "Cotação enviada" da pipeline de Aquisição.
- Ao **cliente aprovar** uma opção: grava `plano_escolhido` (custom field do contato,
  Date/Text já existentes), adiciona tag `opcao_escolhida`, move o card para "Opção
  escolhida", e notifica a Dani.
- Escrita no GHL sempre via route handler server-side. Endpoints v2 relevantes:
  `GET /contacts/`, `PUT /contacts/{id}`, `POST/DELETE /contacts/{id}/tags`,
  `GET /opportunities/search`, `PUT /opportunities/{id}`. Confirme os paths na doc
  oficial (a API v2 evolui).

---

## 10. Escopo

### Dentro (fase 1)
- Form de household + chamada à API do CMS com estimativa.
- Montagem de cotação (híbrido: campos + print), N opções por cotação.
- Página de proposta com aprovar/recusar por opção.
- Persistência (cotações/opções/decisões) + conexão GHL (tags/stage/notificação).
- Marca Leao parametrizável.

### Fora (fase 2+)
- Cálculo de provider/drug coverage.
- Comparação com múltiplos anos.
- Renovação automática puxando cotação nova.
- Multi-idioma da interface (a proposta pode precisar de PT/EN/ES depois — deixar
  preparado, mas não é fase 1).

---

## 11. Guardrails de implementação

- **Sem chave/token no browser.** CMS e GHL só server-side.
- **Sem hardcode** (marca, location, corretora). Multi-tenant desde o início.
- **Camadas isoladas:** `lib/cms/`, `lib/ghl/`, `lib/db/`. Front consome funções
  tipadas.
- **Tipar tudo** (TypeScript). Tipos de domínio em `lib/types.ts`.
- **Tratar rate limit (429) e erro** do CMS e do GHL, com mensagem clara pra Dani.
- **Estimativa sempre rotulada** como tal (§7) — nunca preço final.
- **Privacidade:** storage privado, tokens assinados com expiração, dado sensível
  protegido.
- Sem segredos no repositório. `.env.example` com chaves vazias.
