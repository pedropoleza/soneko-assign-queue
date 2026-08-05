# Talk Link — links de WhatsApp com rastreio real

App **novo e independente**: banco próprio (schema `wa`), edge functions próprias
(`wa-*`), app próprio no Marketplace do GoHighLevel e URL própria. Não divide nada
com o Soneko nem com o Spark QR além do mesmo servidor Postgres.

---

## 1. O problema que ele resolve

Hoje o link de WhatsApp é gerado no ChatGPT e colado no Instagram. A partir daí
não se sabe nada: quantos clicaram, quem veio de qual influenciador, e — o mais
importante — quantos **realmente enviaram** a mensagem em vez de só abrir o
WhatsApp e desistir.

O Talk Link fecha esse funil em três medições:

| Etapa | Como é medida | Confiança |
|---|---|---|
| **Clique** | O link curto é nosso; contamos o acesso antes do 302 | exata |
| **Abriu o WhatsApp** | É o próprio redirect (o clique já implica isso) | exata |
| **Enviou a mensagem** | Webhook `InboundMessage` do GHL + casamento da mensagem | exata a alta |

---

## 2. Como o rastreio viaja

Todo o rastreio vive **na própria URL** e **dentro da mensagem**. Não existe
página intermediária — quem clica cai direto no WhatsApp.

```
https://talk.sparkleads.com/maria-silva/black-friday?s=story&m=instagram&ct=a
                            └── quem ──┘└─ campanha ─┘  └──── onde / como ────┘
                            (slug legível = o "UTM" no caminho)   (nosso UTM curto)
```

| Parâmetro | Equivale a | Exemplo |
|---|---|---|
| `s` | `utm_source` | `bio`, `story`, `reels`, `grupo`, `status` |
| `m` | `utm_medium` | `instagram`, `tiktok`, `whatsapp`, `email` |
| `c` | `utm_campaign` | `blackfriday` |
| `ct` | `utm_content` | `a`, `b` (teste A/B de criativo) |

Os `utm_*` completos também são aceitos, para quem já tem o hábito de colar UTM.

Depois do clique, o redirect monta:

```
https://wa.me/5511999998888?text=<mensagem>+<marcador invisível>
```

### O marcador invisível

O marcador é codificado em **caracteres de largura zero** (`U+200B`, `U+200C`,
`U+200D`, `U+2060`) grudados no fim da mensagem. Cada byte vira 4 símbolos.
Eles **não aparecem** na conversa, sobrevivem a copiar/colar e chegam íntegros
no webhook do GHL.

O conteúdo não é só o código do link:

```
DKPDB*story*a
└─┬─┘ └─┬─┘ └┬┘
  │     │    └── content — variação criativa (`ct` da URL)
  │     └─────── src     — onde foi postado (`s` da URL)
  └───────────── code    — o link, e com ele o influenciador e a campanha
```

| Payload | Tamanho invisível | Quando acontece |
|---|---|---|
| `DKPDB` | 20 caracteres | link sem origem marcada |
| `DKPDB*story` | 44 caracteres | o normal: chip de origem escolhido |
| `DKPDB*story*a` | 60 caracteres | com teste A/B de criativo |

Por que a origem vai **dentro da mensagem** e não só no clique: a mensagem
viaja. Ela é encaminhada para um amigo, o link do WhatsApp é colado direto na
bio sem passar pelo nosso domínio, a gravação do clique falha. Em todos esses
casos o texto é a única coisa que sobra — e ele continua sabendo de onde veio.
Payload só com o código continua válido, então links antigos não quebram.

Modos disponíveis por link:

- `invisible` (padrão) — nada visível, e o único que carrega origem.
- `discreet` — `(ref: DKPDB)` no fim.
- `visible` — `Código: DKPDB` no fim.
- `none` — sem marcador.

### Os dois formatos do link

O mesmo link pode ser distribuído de duas formas. As duas atribuem o **envio**;
só uma delas conta o **clique**.

| | Link rastreado | Link direto do WhatsApp |
|---|---|---|
| Endereço | `talk.sparkleads.com/gabriel/agosto` | `api.whatsapp.com/send/?phone=…&text=…` |
| Conta clique | sim | não |
| Conta envio | sim | sim |
| Origem (`src`) | da URL **e** do marcador | do marcador |
| Bom para | tudo | onde não dá para usar link encurtado |

`wa.me` e `api.whatsapp.com/send/` são a mesma coisa: o primeiro redireciona
para o segundo. Ambos aceitam **só** `phone` e `text` — segmento de caminho
extra devolve `not_found=1` e parâmetro extra o Meta descarta silenciosamente
(testado). É exatamente por isso que o que precisamos medir viaja *dentro* do
`text`, e não ao lado dele.

### As camadas de atribuição

Mesmo se o marcador for perdido (a pessoa apaga, o app higieniza o texto), a
atribuição não cai. O motor tenta, em ordem:

| # | Camada | Como funciona | Confiança |
|---|---|---|---|
| 1 | `invisible_code` | decodifica os caracteres de largura zero | 1.00 |
| 2 | `code` | acha `ref: XXXXX` / `#XXXXX` no texto | 1.00 |
| 3 | `fingerprint` | texto normalizado idêntico à mensagem do link | 0.98 |
| 4 | `prefix` | a pessoa acrescentou ou cortou algo no fim | 0.90 |
| 5 | `head40` | os 40 primeiros caracteres batem | 0.75 |

Por isso a mensagem gerada **sempre inclui o nome do parceiro** — é o que torna
cada link textualmente único e faz a camada 3 funcionar.

Casado o link, amarramos ao **clique aberto mais recente** daquele link (janela
de 7 dias) e gravamos a conversão.

### De onde sai cada métrica

O mapeamento completo — o que é medido, de onde vem e o que chega no CRM:

| Métrica | Fonte | Guardado em | Vale sem clique? |
|---|---|---|---|
| Clique | `GET` no redirecionador | `wa.clicks` | — |
| Envio confirmado | webhook `InboundMessage` | `wa.conversions` | sim |
| Influenciador | `code` do marcador → link → parceiro | `conversions.partner_id` | sim |
| Campanha | `code` do marcador → link | `conversions.link_id` | sim |
| Origem (`src`) | marcador → clique → padrão do link | `conversions.src` | sim, pelo marcador |
| Criativo (`content`) | marcador → clique → padrão do link | `conversions.content` | sim, pelo marcador |
| Canal (`medium`) | só a URL do clique | `clicks.medium` | não |
| Dispositivo / país | cabeçalhos do clique | `clicks.*` | não |
| Confiança | camada que casou | `conversions.confidence` | sim |

`conversions.src_source` registra **como** soubemos a origem: `marker` (veio
dentro da mensagem), `click` (casamos com um clique) ou `link` (padrão do link).
Marcador ganha do clique — ele veio nesta mensagem, o clique é um palpite por
proximidade de tempo.

Cliques e envios são contados cada um na sua fonte e reunidos por origem no
relatório, então um envio que chegou sem clique aparece do mesmo jeito.

No contato do GHL isso vira:

| Onde | Conteúdo |
|---|---|
| Tags | `talk-link`, `origem-<parceiro>`, `campanha-<campanha>`, `local-<origem>` |
| Campo `wa_origem_parceiro` | nome do influenciador |
| Campo `wa_origem_campanha` | nome da campanha |
| Campo `wa_origem_codigo` | código do link |
| Campo `wa_origem_local` | onde foi postado |
| Nota | resumo legível com tudo acima + camada de confirmação + horário |

---

## 3. O que você precisa criar no GoHighLevel

### 3.1 App novo no Marketplace

`Settings → My Apps → Create App` (ou marketplace.gohighlevel.com/app/create).

| Campo | Valor |
|---|---|
| App name | `Talk Link` |
| Distribution type | **Sub-Account** (nível location) |
| App type | White-label / Private (não precisa publicar) |
| Redirect URL | `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-oauth/callback` |

Depois de criar, em **Client Keys**, gere e guarde o **Client ID** e o
**Client Secret**.

### 3.2 Escopos (Scopes)

Marque exatamente estes:

| Escopo | Para quê |
|---|---|
| `locations.readonly` | ler o nome da location na instalação |
| `contacts.readonly` | ler o contato que mandou a mensagem |
| `contacts.write` | gravar tag + campos de origem no contato |
| `conversations.readonly` | ler a conversa |
| **`conversations/message.readonly`** | **libera o webhook `InboundMessage` — sem isso não existe medição de envio** |
| `locations/customFields.readonly` | descobrir se os campos de origem já existem |
| `locations/customFields.write` | criar os campos de origem automaticamente |
| `locations/tags.readonly` | listar tags |
| `locations/tags.write` | aplicar as tags de origem |
| `users.readonly` | identificar o usuário no SSO do iframe |

> `conversations/message.readonly` é o escopo crítico. Se ele não estiver
> marcado, o app instala, gera links e conta cliques — mas nunca confirma envio.

### 3.3 Webhooks

Em **App Settings → Webhooks**, aponte para:

```
https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-webhook
```

Assine estes eventos:

| Evento | Obrigatório? | Para quê |
|---|---|---|
| `InboundMessage` | **sim** | confirma que a mensagem foi enviada de verdade |
| `ContactCreate` | sim | costura o `contactId` quando o contato nasce depois da mensagem |
| `ContactUpdate` | opcional | mesma costura, para contatos atualizados |
| `INSTALL` | sim | cria a conta quando o cliente instala |
| `UNINSTALL` | sim | desativa a conta quando desinstala |

Se o app expuser uma **chave pública de assinatura de webhook**, guarde-a: com
ela configurada, o receptor passa a exigir e validar o header `x-wh-signature`
(RSA-SHA256 sobre o corpo cru). Sem ela configurada, a validação fica desligada.

### 3.4 Página do app dentro do CRM (o iframe)

**URL do app publicado:** `https://talk-link-nu.vercel.app`

#### Qual URL colar no Custom Menu Link

Depende de já existir o app do Marketplace:

**Custom Page do app (recomendado) — um link só, serve para todas as sub-contas.**
Em *App Settings → Custom Page*, URL **sem nenhum parâmetro**:

```
https://talk-link-nu.vercel.app/
```

O iframe pergunta ao GHL quem está logado (`REQUEST_USER_DATA`), manda o
payload cifrado para `/wa-oauth/sso` e recebe a chave da sub-conta. Ninguém vê
segredo na URL, e a sub-conta vem do próprio payload — por isso não se usa
merge field aqui.

> O handshake de SSO **só existe na Custom Page de um app do Marketplace**.
> Num Custom Menu Link comum o CRM ignora o `REQUEST_USER_DATA`, e a entrada
> automática não acontece — use a forma com chave, abaixo.

**Sem o app ainda — um link por sub-conta:**

```
https://talk-link-nu.vercel.app/?secret=<app_secret da location>&location_id={{location.id}}
```

O `secret` é por sub-conta e é o que identifica **e** autentica. Ele fica salvo
no navegador na primeira abertura.

#### Para que serve o `location_id`

`{{location.id}}` é o campo de mesclagem do GHL para a sub-conta aberta.
Ele **não** é credencial — é conferência. Quem administra várias contas e troca
de cliente na mesma aba veria os dados da anterior, porque a chave fica no
navegador. Com o `location_id` na URL, o app compara: se a chave guardada é de
outra sub-conta, ele descarta e refaz o SSO. Se o campo não interpolar, nada
quebra — só perde essa conferência.

#### Se aparecer "refused to connect"

O navegador está recusando o enquadramento. Três causas, nesta ordem:

1. **Vercel Authentication ligada.** Todo projeto novo nasce com ela em
   `all_except_custom_domains`, o que exige login da Vercel — dentro de um
   iframe isso vira "refused to connect". Desligue em
   *Project → Settings → Deployment Protection*.
2. **`X-Frame-Options` inválido.** Esse header aceita um valor único, não uma
   lista, e valores inválidos (como `ALLOWALL`) fazem o Chrome bloquear tudo.
   Não use — quem controla isso é o `frame-ancestors` do CSP.
3. **Domínio white-label fora da lista.** O `frame-ancestors` em
   `apps/talk-link/vercel.json` precisa conter o domínio em que o CRM abre.
   Hoje cobre `*.gohighlevel.com`, `*.leadconnectorhq.com`, `*.msgsndr.com`,
   `*.sparkleads.pro` e `*.sparkleads.com`. Se o CRM do cliente abrir em outro,
   acrescente lá e faça deploy.

Para conferir sem abrir o CRM:

```bash
curl -sI https://talk-link-nu.vercel.app/ | grep -i -e x-frame -e content-security
```

Tem que sair **só** o `content-security-policy` com o domínio do CRM na lista,
e nenhum `x-frame-options`.

### 3.5 O número de WhatsApp

O número de destino **precisa ser o número conectado ao GHL** (LC Phone /
WhatsApp provider da location). É esse número que faz o GHL disparar o
`InboundMessage`. Se o link apontar para um número fora do CRM, o clique é
contado mas o envio nunca é confirmado.

### 3.6 O que o app cria sozinho na location

Na primeira conversão, o app cria (se não existirem) e preenche:

**Campos personalizados de contato**
- `Origem — Parceiro`
- `Origem — Campanha`
- `Origem — Código`
- `Origem — Onde`

**Tags**
- `talk-link`
- `origem-<parceiro>` (ex.: `origem-maria-silva`)
- `campanha-<campanha>` (ex.: `campanha-black-friday`)
- `local-<origem>` (ex.: `local-story`) — só quando a origem é conhecida

**Nota no contato** com link, parceiro, campanha, onde foi postado, código e
como a origem foi confirmada.

---

## 4. Configuração do backend

Preencha estas chaves na tabela `wa.app_config` (ou como env vars das functions,
que têm prioridade):

| Chave | Valor |
|---|---|
| `GHL_CLIENT_ID` | Client ID do app novo |
| `GHL_CLIENT_SECRET` | Client Secret do app novo |
| `GHL_OAUTH_REDIRECT_URI` | `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-oauth/callback` |
| `GHL_SSO_KEY` | SSO Key do app (para o iframe) |
| `GHL_WEBHOOK_PUBLIC_KEY` | chave pública de assinatura, se o app fornecer (opcional) |
| `WA_APP_URL` | URL pública do front (ex.: `https://talk-link.vercel.app`) |
| `WA_CLICK_SALT` | string aleatória — sal do hash de IP dos cliques |
| `WA_WEBHOOK_SECRET` | opcional, só se usar o webhook via Workflow (seção 7) |

```sql
select public.wa_set_config('GHL_CLIENT_ID', '...');
select public.wa_set_config('GHL_CLIENT_SECRET', '...');
select public.wa_set_config('GHL_OAUTH_REDIRECT_URI', 'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-oauth/callback');
select public.wa_set_config('GHL_SSO_KEY', '...');
select public.wa_set_config('WA_APP_URL', 'https://...');
select public.wa_set_config('WA_CLICK_SALT', encode(gen_random_bytes(16), 'hex'));
```

---

## 5. Domínio curto (`talk.sparkleads.com`)

O redirecionador é a função `wa-redirect`. Para ele atender no domínio bonito,
coloque um proxy na frente — mesma ideia do `qr.sparkleads.com`.

**Opção A — projeto Vercel dedicado** (pronto em `apps/talk-redirect/`):
aponte o CNAME de `talk.sparkleads.com` para a Vercel e faça deploy da pasta.
O `vercel.json` já reescreve tudo para a edge function preservando o caminho e
a query string.

**Opção B — Cloudflare Worker:**

```js
export default {
  fetch(request) {
    const url = new URL(request.url);
    return fetch(
      `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-redirect${url.pathname}${url.search}`,
      { headers: request.headers, redirect: 'manual' },
    );
  },
};
```

Enquanto o DNS não estiver pronto, o app funciona usando a URL da própria
função. Depois é só salvar o domínio em **Ajustes** — os links já criados passam
a ser exibidos com o domínio novo (o slug não muda).

---

## 6. Deploy do front

App independente em `apps/talk-link/`. Novo projeto na Vercel:

| Configuração | Valor |
|---|---|
| Root Directory | `apps/talk-link` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output | `dist` |

Variáveis de ambiente:

```
VITE_TALK_API_URL=https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-api
VITE_TALK_OAUTH_URL=https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-oauth
VITE_TALK_SHORT_DOMAIN=https://talk.sparkleads.com
```

O `vercel.json` do app já libera o embed em iframe nos domínios do GHL.

---

## 7. Plano B: começar antes da aprovação do app

Dá para medir envio sem o app do Marketplace, usando um **Workflow**:

- Trigger: `Customer Replied` (ou `Inbound Message`)
- Ação: `Webhook` → `POST` para
  `https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-webhook`
- Header: `x-wa-webhook-secret: <o valor de WA_WEBHOOK_SECRET>`
- Body (JSON customizado):

```json
{
  "type": "InboundMessage",
  "locationId": "{{location.id}}",
  "contactId": "{{contact.id}}",
  "contactName": "{{contact.name}}",
  "phone": "{{contact.phone}}",
  "messageId": "{{message.id}}",
  "conversationId": "{{conversation.id}}",
  "body": "{{message.body}}",
  "dateAdded": "{{message.date_added}}"
}
```

Limitação: sem OAuth não dá para gravar tag/campo no contato — as métricas
aparecem no painel, mas a origem não volta para o CRM. Serve para validar o
funil enquanto o app é aprovado.

---

## 8. Arquitetura

```
  Instagram / story / grupo
            │  clique
            ▼
  talk.sparkleads.com/maria-silva/black-friday?s=story
            │
            ▼
  ┌──────────────────┐   grava clique (device, origem, país)
  │   wa-redirect    │──────────────────────────────► wa.clicks
  └────────┬─────────┘
           │ 302 (≈30 ms, sem página intermediária)
           ▼
  wa.me/55...?text=<mensagem + marcador invisível>
           │
           │ a pessoa aperta enviar
           ▼
  ┌──────────────────┐
  │  GoHighLevel     │  InboundMessage
  └────────┬─────────┘
           ▼
  ┌──────────────────┐  casa marcador → código → texto
  │    wa-webhook    │──► wa.conversions  +  tag/campos/nota no contato
  └──────────────────┘

  ┌──────────────────┐
  │     wa-api       │◄── iframe do app dentro do GHL
  └──────────────────┘
```

### Endpoints

| Função | URL | JWT |
|---|---|---|
| `wa-redirect` | `/functions/v1/wa-redirect/{slug}` | não |
| `wa-webhook` | `/functions/v1/wa-webhook` | não |
| `wa-oauth` | `/functions/v1/wa-oauth/{install,callback,sso}` | não |
| `wa-api` | `/functions/v1/wa-api/*` | não (usa `x-wa-secret`) |

### Banco (schema `wa`)

| Tabela | O que guarda |
|---|---|
| `accounts` | uma linha por location instalada, com o app secret |
| `oauth_tokens` | access/refresh token do GHL |
| `partners` | influenciadores, lojas, parceiros |
| `links` | campanhas: slug, código, mensagem, número, UTMs |
| `clicks` | cada acesso: device, origem da URL, país, se virou envio |
| `conversions` | cada mensagem confirmada, com como foi casada |
| `templates` | mensagens salvas |
| `webhook_events` | log bruto de tudo que o GHL manda |
| `app_config` | configuração global |

O schema `wa` **não** é exposto pelo PostgREST. Todo acesso passa pelas RPCs
`public.wa_*` (`SECURITY DEFINER`), executadas só com a service role.

---

## 9. Checklist de validação

1. Instalar o app na location → conferir que apareceu linha em `wa.accounts`.
2. Abrir o app pelo menu do GHL → o painel carrega sem pedir chave (SSO ok).
3. Salvar o número do WhatsApp em **Ajustes**.
4. Gerar um link para um parceiro de teste.
5. Abrir o link no celular → o WhatsApp abre com a mensagem pronta.
6. Conferir o clique em **Métricas → Cliques recentes**.
7. Enviar a mensagem → em até alguns segundos ela aparece em
   **Últimos envios confirmados** com `marcador invisível`.
8. Abrir o contato no GHL → tag `talk-link`, tags de origem, campos preenchidos
   e a nota de origem.

Se o passo 7 não acontecer:

```sql
select received_at, event_type, status, detail
from wa.webhook_events
order by received_at desc limit 20;
```

- Sem evento nenhum → webhook ou escopo `conversations/message.readonly` faltando.
- `status = 'ignored'` com `no_link_match` → a mensagem chegou mas não bateu com
  nenhum link (texto muito alterado ou link de outra location).
- Conversão criada mas `crm_synced = false` → veja `crm_error` em
  `wa.conversions`: normalmente é escopo de `contacts.write` faltando.

---

## 10. Limites conhecidos

- **Cliques anônimos.** No momento do clique não sabemos o telefone de quem
  clicou — só descobrimos quando a mensagem chega. Por isso o clique é amarrado
  ao envio pelo clique aberto mais recente daquele link, não por identidade.
  Em volume alto no mesmo link e no mesmo minuto, essa amarração pode trocar
  cliques entre si; os totais por link e por parceiro continuam corretos.
- **Preview do WhatsApp.** O robô que gera a pré-visualização do link é
  detectado e marcado como bot — não conta como clique.
- **Mensagem reescrita.** Se a pessoa apagar tudo e escrever do zero, nenhuma
  camada casa. O marcador invisível cobre a maioria dos casos, porque ele
  sobrevive a edições no meio do texto.
- **Número fora do CRM.** Link apontando para número não conectado ao GHL conta
  clique, mas nunca confirma envio.
