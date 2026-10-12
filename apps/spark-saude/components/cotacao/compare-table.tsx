"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { metalStyle } from "@/lib/cotacao/metal";
import type { Highlight } from "@/lib/cotacao/highlights";
import { highlightsOf } from "@/lib/cotacao/highlights";
import type { PlanQuote } from "@/lib/cotacao/types";
import { cn, formatMoneyBR } from "@/lib/utils";

/**
 * O comparativo em tabela — uma linha por plano.
 *
 * Com até três opções, cards lado a lado funcionam. A partir de quatro eles
 * viram uma parede de 600px de altura cada, e comparar dedutível com dedutível
 * exige rolar para cima e para baixo. Em tabela os mesmos números ficam em
 * colunas alinhadas, que é como se compara preço com preço.
 *
 * Usada na tela da corretora e na página do cliente, para os dois olharem a
 * mesma grade e falarem dos mesmos números ao telefone.
 */

type SortKey = "premioMensal" | "dedutivel" | "maxBolso" | "custoAnualEstimado";

const COLS: Array<{ key: SortKey; label: string; hint: string }> = [
  { key: "premioMensal", label: "Mensalidade", hint: "o que você paga por mês, já com o crédito" },
  { key: "dedutivel", label: "Dedutível", hint: "quanto você paga antes de o plano dividir os custos" },
  { key: "maxBolso", label: "Máx. do bolso", hint: "o teto do que você gasta no ano" },
  { key: "custoAnualEstimado", label: "Custo no ano", hint: "gasto total estimado em 12 meses" },
];

export function CompareTable({
  options,
  recommendedPlanId,
  highlights = [],
  onRowClick,
  renderAction,
  pendingIds,
  className,
}: {
  options: PlanQuote[];
  recommendedPlanId?: string | null;
  highlights?: Highlight[];
  /**
   * Planos herdados de outro cenário de renda, ainda com o preço antigo. Zero
   * não é preço: mostramos um traço e um aviso, senão a linha parece pronta.
   */
  pendingIds?: Set<string>;
  onRowClick?: (planId: string) => void;
  renderAction?: (plan: PlanQuote, index: number) => React.ReactNode;
  className?: string;
}) {
  const [sort, setSort] = React.useState<SortKey>("premioMensal");

  // Coluna que nenhum plano preenche vira uma fileira de traços roubando um
  // quarto da largura — os prints da seguradora quase nunca trazem o custo
  // anual estimado, que só vem do Marketplace.
  const cols = React.useMemo(
    () =>
      COLS.filter((c) =>
        c.key === "premioMensal"
          ? true
          : options.some((o) => typeof o[c.key] === "number" && Number.isFinite(o[c.key] as number)),
      ),
    [options],
  );

  // A recomendada abre a tabela, sempre — é a leitura que a corretora quer que
  // aconteça primeiro. O resto ordena pelo critério escolhido, e o que não tem
  // o dado vai para o fim em vez de fingir que vale zero.
  const rows = React.useMemo(() => {
    // A coluna de ordenação pode ter sumido (nenhum plano preenche) — cai na
    // mensalidade, que sempre existe.
    const active = cols.some((c) => c.key === sort) ? sort : "premioMensal";
    const value = (p: PlanQuote) => {
      const v = p[active];
      return typeof v === "number" && Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
    };
    return [...options].sort((a, b) => {
      if (a.planId === recommendedPlanId) return -1;
      if (b.planId === recommendedPlanId) return 1;
      return value(a) - value(b);
    });
  }, [options, recommendedPlanId, sort, cols]);

  const cell = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? formatMoneyBR(v) : "—";

  return (
    <div className={cn("overflow-x-auto rounded-lg border bg-card", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plano
            </th>
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-right">
                <button
                  type="button"
                  title={`${c.hint} — clique para ordenar`}
                  onClick={() => setSort(c.key)}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                    sort === c.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label}
                  {sort === c.key ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3 opacity-0" />}
                </button>
              </th>
            ))}
            {renderAction ? <th className="px-3 py-2.5" /> : null}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((plan, i) => {
            const metal = metalStyle(plan.metalLevel);
            const mine = highlightsOf(highlights, plan.planId);
            const isRec = plan.planId === recommendedPlanId;
            const pending = pendingIds?.has(plan.planId) ?? false;
            return (
              <tr
                key={plan.planId}
                onClick={onRowClick ? () => onRowClick(plan.planId) : undefined}
                className={cn(
                  "align-middle transition-colors",
                  isRec ? "bg-accent-soft/60" : i % 2 ? "bg-muted/20" : "",
                  onRowClick && "cursor-pointer hover:bg-muted/60",
                )}
              >
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
                      style={{ background: metal.ink }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-snug">
                        {plan.nomePlano}
                        {isRec ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                            <Star className="h-3 w-3 fill-current" /> Recomendada
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("rounded-full px-1.5 py-0.5 font-semibold", metal.chip)}>
                          {metal.label}
                        </span>
                        {plan.tipoPlano ? <span>{plan.tipoPlano}</span> : null}
                        <span className="truncate">{plan.seguradora}</span>
                      </p>
                      {pending ? (
                        <p className="mt-1">
                          <span className="rounded-full bg-status-amber-bg px-1.5 py-0.5 text-xs font-semibold text-status-amber-fg">
                            Revisar preço
                          </span>
                        </p>
                      ) : null}
                      {mine.length ? (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {mine.map((h) => (
                            <span
                              key={h.key}
                              title={h.explain}
                              className="rounded-full bg-status-green-bg px-1.5 py-0.5 text-xs font-semibold text-status-green-fg"
                            >
                              {h.label}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {pending ? (
                    <>
                      <span className="text-base font-semibold text-muted-foreground">—</span>
                      <span className="block text-xs text-status-amber-fg">renda nova</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base font-semibold" style={{ color: metal.ink }}>
                        {formatMoneyBR(plan.premioMensal)}
                      </span>
                      <span className="block text-xs text-muted-foreground">/mês</span>
                    </>
                  )}
                </td>
                {cols
                  .filter((c) => c.key !== "premioMensal")
                  .map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-3 text-right font-medium">
                      {cell(plan[c.key] as number | null | undefined)}
                    </td>
                  ))}

                {renderAction ? (
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {renderAction(plan, i)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
