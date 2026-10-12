import type { Dict } from "./i18n";
import type { PlanQuote } from "./types";

/**
 * Destaques: qual plano ganha em cada critério.
 *
 * Com duas ou três opções o cliente compara sozinho. Com seis ou oito, a
 * comparação vira uma parede de números e ele trava — ou escolhe pelo primeiro
 * que leu. Os destaques existem para dar o caminho curto: em vez de ler tudo,
 * ele lê "este é o mais barato", "neste você gasta menos no pior ano".
 *
 * Um destaque só é emitido quando há um vencedor ÚNICO. Um selo "mais barato"
 * em três planos empatados não ensina nada — e empate em dinheiro é comum
 * quando o crédito fiscal zera a mensalidade de vários planos ao mesmo tempo.
 *
 * O mesmo cálculo alimenta a tela da corretora, o PDF e a página do cliente,
 * para os três falarem a mesma língua sobre os mesmos planos.
 */

export type HighlightKey =
  | "maisBarato"
  | "menorDedutivel"
  | "menorTeto"
  | "menorCustoAnual"
  | "melhorAvaliado";

export interface Highlight {
  key: HighlightKey;
  /** Selo curto, para caber num chip ("Mais barato"). */
  label: string;
  /** O que o critério significa, em uma linha. */
  explain: string;
  planId: string;
  /** Valor já formatado, na moeda/locale da peça. */
  value: string;
}

/** O menor valor vence, exceto na avaliação — lá vence o maior. */
const AXES: Array<{
  key: HighlightKey;
  pick: (p: PlanQuote) => number | null | undefined;
  best: "min" | "max";
}> = [
  { key: "maisBarato", pick: (p) => p.premioMensal, best: "min" },
  { key: "menorCustoAnual", pick: (p) => p.custoAnualEstimado, best: "min" },
  { key: "menorDedutivel", pick: (p) => p.dedutivel, best: "min" },
  { key: "menorTeto", pick: (p) => p.maxBolso, best: "min" },
  { key: "melhorAvaliado", pick: (p) => p.qualityRating, best: "max" },
];

export function computeHighlights(
  options: PlanQuote[],
  d: Dict,
  money: (n: number | null | undefined) => string,
): Highlight[] {
  // Com uma opção só não existe comparação — e um selo "mais barato" num
  // conjunto de um é ruído, não informação.
  if (options.length < 2) return [];

  const out: Highlight[] = [];
  for (const axis of AXES) {
    const scored = options
      .map((p) => ({ p, v: axis.pick(p) }))
      .filter((x): x is { p: PlanQuote; v: number } => typeof x.v === "number" && Number.isFinite(x.v));
    if (scored.length < 2) continue; // critério que poucos planos informam não compara

    const bestValue = scored.reduce(
      (acc, x) => (axis.best === "min" ? Math.min(acc, x.v) : Math.max(acc, x.v)),
      scored[0].v,
    );
    const winners = scored.filter((x) => x.v === bestValue);
    if (winners.length !== 1) continue; // empate não vira selo

    const { p, v } = winners[0];
    out.push({
      key: axis.key,
      label: d.highlights[axis.key].label,
      explain: d.highlights[axis.key].explain,
      planId: p.planId,
      value: axis.key === "melhorAvaliado" ? `${v.toFixed(1)} / 5` : money(v),
    });
  }
  return out;
}

/** Os destaques de um plano específico — para desenhar os selos no card. */
export function highlightsOf(all: Highlight[], planId: string): Highlight[] {
  return all.filter((h) => h.planId === planId);
}

/**
 * O subconjunto que vai para a faixa de destaques.
 *
 * Um plano bom costuma ganhar em vários critérios ao mesmo tempo — e uma faixa
 * que diz "Molina, Molina, Molina, Molina" não ensina nada, só repete. Aqui
 * limitamos a um destaque por plano, na ordem de importância dos critérios, e a
 * três chips no total. A lista completa continua nos selos de cada card e na
 * tabela, onde a repetição é informação em vez de ruído.
 */
export function topHighlights(all: Highlight[], limit = 3): Highlight[] {
  const seen = new Set<string>();
  const out: Highlight[] = [];
  for (const h of all) {
    if (seen.has(h.planId)) continue;
    seen.add(h.planId);
    out.push(h);
    if (out.length === limit) break;
  }
  return out;
}
