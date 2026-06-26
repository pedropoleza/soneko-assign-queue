# Spark QR — redirect host (dedicated)

Projeto Vercel **isolado**, dedicado só ao redirect público dos QRs. Mantém o
redirecionamento **fora do painel** (decoupling): trancar/derrubar o painel não
afeta os QRs, e o redirect não passa pela página do painel.

- `vercel.json` faz proxy de `/{slug}` → Edge Function `spark-qr-redirect` no
  Supabase. O cliente nunca vê a URL do Supabase.
- É o domínio que os QR codes codificam (`VITE_QR_PUBLIC_BASE` no painel aponta
  para cá). Quando o DNS estiver pronto, aponte `qr.sparkleads.com` para este
  projeto e atualize a env.

## Deploy

```bash
cd qr-redirect
vercel deploy --prod   # projeto separado do painel
```
