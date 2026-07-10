// Política de conteúdo anti-abuso (seção 2.4 / D4).
// MVP: sanitiza e REJEITA quando bate em padrões de alto risco (fraude, urgência
// falsa, ameaça, autoridade pública, cobrança abusiva). A lista é o ponto de
// partida — o Time refina em D4. Severidade padrão = rejeitar.

// Padrões PT/EN de alto risco. Deliberadamente conservador para o MVP.
const BLOCKED_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(pix|dep[oó]sito|transfer[eê]ncia)\s+(urgente|imediat)/i, label: 'cobranca_urgente' },
  { re: /\bsua conta ser[aá] (bloqueada|suspensa|cancelada)\b/i, label: 'ameaca_conta' },
  { re: /\b(mandado|intima[cç][aã]o|processo judicial|pol[ií]cia|receita federal)\b/i, label: 'autoridade_publica' },
  { re: /\b(voc[eê] ganhou|pr[eê]mio|sorteio|b[oô]nus exclusivo)\b.*\b(clique|resgat)/i, label: 'isca_premio' },
  { re: /\b([uú]ltim[ao]s?\s+(minutos|horas)|agora ou nunca|expira em)\b/i, label: 'urgencia_falsa' },
  { re: /\b(senha|c[oó]digo de verifica[cç][aã]o|cvv|n[uú]mero do cart[aã]o)\b/i, label: 'phishing_credencial' },
];

export type PolicyResult = { ok: boolean; violations: string[] };

/** Verifica o texto final contra a blocklist. */
export function checkContentPolicy(text: string): PolicyResult {
  const violations: string[] = [];
  for (const { re, label } of BLOCKED_PATTERNS) {
    if (re.test(text)) violations.push(label);
  }
  return { ok: violations.length === 0, violations };
}

/** Sanitização leve: remove caracteres de controle e colapsa espaços. */
export function sanitizeText(text: string): string {
  return text
    // remove caracteres de controle (mantém \n e \t)
    // deno-lint-ignore no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
