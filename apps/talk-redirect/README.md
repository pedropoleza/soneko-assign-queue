# talk-redirect

Projeto mínimo cuja única função é dar um domínio bonito ao redirecionador.

`talk.sparkleads.com/maria-silva/black-friday?s=story`
→ reescreve para a edge function `wa-redirect`, preservando caminho e query.

## Deploy

Novo projeto na Vercel com **Root Directory** = `apps/talk-redirect`, sem build
(é só o `vercel.json`). Depois adicione o domínio `talk.sparkleads.com` ao
projeto e aponte o CNAME conforme a Vercel indicar.

Alternativa sem Vercel: o Cloudflare Worker documentado em
`docs/talk-link/README.md`, seção 5.
