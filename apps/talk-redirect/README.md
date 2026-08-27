# talk-redirect

Projeto mínimo que dá um domínio bonito ao redirecionador — e é o único ponto
do caminho que sabe de onde a pessoa está clicando.

`talk.sparkleads.com/maria-silva/black-friday?s=story`
→ `api/go.ts` (edge) → edge function `wa-redirect`, preservando caminho e query.

## Por que não é só um rewrite

Era, e por isso `country` e `city` nasciam nulos em **todo** clique: a Vercel
injeta os `x-vercel-ip-*` na própria borda, e um rewrite para um destino
*externo* repassa só os cabeçalhos originais do cliente. Do outro lado, o
runtime do Supabase também não entrega o `cf-ipcountry`. A localização
simplesmente não existia em nenhum ponto que soubesse gravar o clique.

`api/go.ts` lê a localização onde ela existe e reenvia em `x-geo-country` /
`x-geo-city`. O 302 do upstream é repassado sem ser seguido — nenhuma página a
mais no caminho da pessoa.

## Deploy

Novo projeto na Vercel com **Root Directory** = `apps/talk-redirect`, sem build
(só `vercel.json` + a função edge em `api/`). Depois adicione o domínio
`talk.sparkleads.com` ao projeto e aponte o CNAME conforme a Vercel indicar.

Alternativa sem Vercel: o Cloudflare Worker documentado em
`docs/talk-link/README.md`, seção 5.
