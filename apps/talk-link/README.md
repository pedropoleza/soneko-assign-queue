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

## Estrutura

```
src/
  App.tsx                    abas e estado global
  lib/
    api.ts                   cliente da edge function wa-api
    config.ts                chave de acesso + SSO do GHL
    message.ts               geração da mensagem por objetivo/tom/idioma
    trackingUrl.ts           montagem da URL com os parâmetros de origem
  components/
    CampaignForm.tsx         formulário de nova campanha
    LinkResult.tsx           link gerado, pronto para copiar
    LinksPanel.tsx           tabela de links + últimos envios
    PartnersPanel.tsx        parceiros e ranking
    MetricsPanel.tsx         painel de métricas
    LinkDetailDrawer.tsx     detalhe de um link
    SettingsPanel.tsx        número padrão e domínio curto
```

## Deploy

Projeto separado na Vercel, **Root Directory** = `apps/talk-link`.
Variáveis em `.env.example`.
