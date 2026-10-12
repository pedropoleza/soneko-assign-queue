"use client";

import { metalStyle } from "@/lib/cotacao/metal";
import type { Highlight } from "@/lib/cotacao/highlights";
import type { PlanQuote } from "@/lib/cotacao/types";
import { cn } from "@/lib/utils";

/**
 * A faixa de destaques — o resumo que se lê em cinco segundos.
 *
 * É a primeira coisa na comparação porque responde à pergunta que o cliente faz
 * de verdade ("qual é o mais barato?", "em qual eu gasto menos no pior ano?")
 * sem obrigá-lo a cruzar oito linhas de números. Cada destaque nomeia o plano
 * vencedor e o valor, e explica o critério em uma linha — um selo sem
 * explicação vira enfeite.
 */
export function HighlightStrip({
  highlights,
  options,
  onPick,
  className,
}: {
  highlights: Highlight[];
  options: PlanQuote[];
  onPick?: (planId: string) => void;
  className?: string;
}) {
  if (!highlights.length) return null;
  const nameOf = (planId: string) => options.find((o) => o.planId === planId);

  return (
    <div className={cn("grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {highlights.map((h) => {
        const plan = nameOf(h.planId);
        const metal = plan ? metalStyle(plan.metalLevel) : null;
        const Tag = onPick ? "button" : "div";
        return (
          <Tag
            key={h.key}
            {...(onPick ? { type: "button" as const, onClick: () => onPick(h.planId) } : {})}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left shadow-card",
              onPick && "transition-colors hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            <span
              className="mt-0.5 h-full min-h-[34px] w-1 shrink-0 rounded-full"
              style={{ background: metal?.ink ?? "currentColor" }}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-status-green-fg">{h.label}</span>
                <span className="text-sm font-semibold">{h.value}</span>
              </span>
              <span className="mt-0.5 block truncate text-sm font-medium">{plan?.nomePlano ?? "—"}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{h.explain}</span>
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
