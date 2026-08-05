# Talk Link — app

Gerador de links de WhatsApp por influenciador, com rastreio de clique e de
mensagem efetivamente enviada. Roda como iframe dentro do GoHighLevel.

Documentação completa (escopos, webhooks, DNS, arquitetura):
[`docs/talk-link/README.md`](../../docs/talk-link/README.md).

## Rodando local

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:5174/?secret=<app secret da location>` na primeira vez.
A chave fica salva no localStorage; dentro do GHL ela vem sozinha pelo SSO.

## Ideia da interface

O app faz **três perguntas** — quem indicou, sobre o quê, e a mensagem — e devolve
o link. Tudo o que tem um padrão razoável (nome da campanha, endereço, idioma,
número, tipo de marcador) fica atrás de *Mais opções*.

A resposta aparece como uma **conversa de WhatsApp**: é o jeito honesto de mostrar
para quem não é técnico que o rastreio é mesmo invisível — a mensagem está ali,
inteira, e não há nada de estranho nela.

## Estrutura

```
src/
  App.tsx                    três abas e estado global
  fonts.css                  Outfit + Public Sans embutidos (sem request externo)
  index.css                  tokens de cor/tipo, tema claro e escuro
  lib/
    api.ts                   cliente da edge function wa-api
    config.ts                chave de acesso + SSO do GHL
    message.ts               geração da mensagem por assunto/tom/idioma
    trackingUrl.ts           montagem da URL com os parâmetros de origem
  components/
    CreatePage.tsx           as três perguntas
    ChatPreview.tsx          a conversa como o lead vai ver
    LinkReady.tsx            link pronto: copiar e escolher onde postar
    ResultsPage.tsx          números, gráfico e as listas (campanha/parceiro/origem)
    LinkDetailDrawer.tsx     detalhe de uma campanha
    SettingsPage.tsx         número padrão e endereço dos links
    Stats.tsx                número grande, anel de conversão, barras, ranking
    Topbar.tsx  ui.tsx       navegação e primitivas
```

## Deploy

Projeto separado na Vercel, **Root Directory** = `apps/talk-link`.
Variáveis em `.env.example`.
