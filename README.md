# Soneko Assign Queue

Painel interno que recebe webhooks de criação de contato do GoHighLevel (Soneko) e distribui leads em round-robin entre os consultores, com botão de pular para o próximo da fila ou para um vendedor específico.

> **Outros apps neste repositório**
> `apps/talk-link/` — **Talk Link**, app independente (banco, edge functions, app
> no Marketplace e URL próprios) que gera links de WhatsApp por influenciador e
> mede clique *e* mensagem efetivamente enviada.
> Documentação: [`docs/talk-link/README.md`](docs/talk-link/README.md).

## Arquitetura

- **Frontend** — Vite + React + Tailwind + Radix UI primitives. Layout wide, sem sidebar, paleta GHL (branco/cinza/azul).
- **Backend** — Supabase (projeto `GHL Token`, schema `soneko`).
  - Tabelas: `locations`, `sales_reps`, `assignment_queue`, `assignments`, `webhook_events`, `audit_log`.
  - RPCs `public.soneko_*` expostas como API SECURITY DEFINER (autenticadas via app secret).
  - Edge Function `soneko-ghl-webhook` — recebe payload do GHL e atribui ao próximo rep.
  - Edge Function `soneko-api` — `/state`, `/skip`, `/reps/toggle`, `/reps/reorder` consumida pelo frontend.

## Webhook URL (cola no GHL)

```
POST https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/soneko-ghl-webhook
Header: x-soneko-secret: <app secret da location>
Body (JSON):
{
  "contact_id": "{{contact.id}}",
  "full_name":  "{{contact.name}}",
  "email":      "{{contact.email}}",
  "phone":      "{{contact.phone}}",
  "source":     "{{contact.source}}",
  "location":   { "id": "{{location.id}}" }
}
```

## Rodando localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173/?secret=<app secret>` na primeira vez.

## Custom Menu Link no GHL

Em **Settings → Custom Menu Links**, adicione um link apontando para a URL pública do app (`?secret=...`). O secret fica salvo em localStorage do navegador.
