"use client";

import * as React from "react";
import { Check, Star, Image as ImageIcon, Pencil, ChevronRight } from "lucide-react";
import type { PlanQuote } from "@/lib/cotacao/types";
import { cn, formatMoneyBR } from "@/lib/utils";

/** Metal-level accent — a quiet visual anchor per tier. */
const METAL: Record<string, string> = {
  Bronze: "bg-[rgba(180,83,9,0.10)] text-[#B45309]",
  "Expanded Bronze": "bg-[rgba(180,83,9,0.10)] text-[#B45309]",
  Silver: "bg-[rgba(100,116,139,0.12)] text-[#475569]",
  Gold: "bg-[rgba(202,138,4,0.12)] text-[#A16207]",
  Platinum: "bg-[rgba(79,70,229,0.12)] text-[#4338CA]",
  Catastrophic: "bg-muted text-muted-foreground",
};

export interface PlanTableProps {
  plans: PlanQuote[];
  selectedIds: Set<string>;
  bestId?: string;
  onToggle: (plan: PlanQuote) => void;
  onEdit?: (plan: PlanQuote) => void;
  onAttachPrint?: (plan: PlanQuote, file: File) => void;
  printByPlanId?: Record<string, string | null | undefined>;
}

/**
 * The broker-facing plan comparison (Ponta A). A dense table — not cards —
 * because triaging 40+ plans across premium, deductible, MOOP and copays is a
 * scanning task, and columns make that scan possible at a glance. The card
 * layout is reserved for the client-facing proposal (Ponta B), where there are
 * only 2–3 options and the job is persuasion, not triage.
 *
 * Only the decision-driving numbers get a column; the full "Usted paga" table
 * expands per row. That keeps the grid inside the pane instead of forcing a
 * horizontal scroll, which is the whole point of the iframe layout.
 */
export function PlanTable({
  plans,
  selectedIds,
  bestId,
  onToggle,
  onEdit,
  onAttachPrint,
  printByPlanId = {},
}: PlanTableProps) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/60">
          <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="w-9 px-2.5 py-2.5" />
            <th className="px-2.5 py-2.5">Plano</th>
            <th className="w-[126px] px-2.5 py-2.5 text-right">Prêmio/mês</th>
            <th className="w-[104px] px-2.5 py-2.5 text-right">Dedutível</th>
            <th className="w-[104px] px-2.5 py-2.5 text-right">Máx. bolso</th>
            <th className="w-[104px] px-2.5 py-2.5 text-right">Custo anual</th>
            <th className="w-[96px] px-2.5 py-2.5">Primária</th>
            <th className="w-[72px] px-2.5 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {plans.map((p) => {
            const selected = selectedIds.has(p.planId);
            const isOpen = expanded === p.planId;
            const print = printByPlanId[p.planId];
            return (
              <React.Fragment key={p.planId}>
                <tr
                  onClick={() => onToggle(p)}
                  className={cn(
                    "cursor-pointer align-middle transition-colors",
                    selected ? "bg-[rgba(21,94,239,0.06)]" : "hover:bg-muted/50",
                  )}
                >
                  <td className="px-2.5 py-2.5">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                      )}
                      aria-hidden
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected}
                      onChange={() => onToggle(p)}
                      aria-label={`Selecionar ${p.nomePlano}`}
                    />
                  </td>

                  <td className="min-w-0 px-2.5 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{p.nomePlano}</span>
                      {p.planId === bestId ? (
                        <span className="shrink-0 rounded-full bg-[rgba(18,183,106,0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-[#0E9F6E]">
                          menor preço
                        </span>
                      ) : null}
                      {p.fonte === "manual" ? (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          manual
                        </span>
                      ) : null}
                    </div>
                    {/* One quiet metadata line — seguradora · tier · design ·
                        rating. Everything else lives in the expanded detail so
                        the grid stays scannable. */}
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{p.seguradora}</span>
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", METAL[p.metalLevel] ?? "bg-muted")}>
                        {p.metalLevel}
                      </span>
                      {p.tipoPlano ? <span className="shrink-0 text-[11px]">· {p.tipoPlano}</span> : null}
                      {p.qualityRating != null ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 text-[11px]"
                          title={`${p.qualityRating} de 5 estrelas (CMS)`}
                        >
                          <Star className="h-3 w-3 fill-[#F79009] text-[#F79009]" />
                          <span className="tabular-nums">{p.qualityRating.toFixed(1)}</span>
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-2.5 py-2.5 text-right">
                    <div className="font-semibold tabular-nums">{formatMoneyBR(p.premioMensal)}</div>
                    {p.creditoFiscal > 0 ? (
                      <div className="text-[10px] tabular-nums text-muted-foreground">
                        <span className="line-through">{formatMoneyBR(p.premioSemCredito)}</span>{" "}
                        <span className="font-medium text-[#0E9F6E]">−{formatMoneyBR(p.creditoFiscal)}</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums">{formatMoneyBR(p.dedutivel)}</td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums">{formatMoneyBR(p.maxBolso)}</td>
                  <td className="px-2.5 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {p.custoAnualEstimado != null ? formatMoneyBR(p.custoAnualEstimado) : "—"}
                  </td>
                  <td className="px-2.5 py-2.5 text-xs text-muted-foreground">
                    <span className="line-clamp-2">{p.atencaoPrimaria || "—"}</span>
                  </td>

                  <td className="px-2.5 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      {onAttachPrint ? (
                        <label
                          className={cn(
                            "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-input transition-colors hover:bg-muted",
                            print && "border-primary/40 bg-[rgba(21,94,239,0.08)] text-primary",
                          )}
                          title={print ? "Print anexado — trocar" : "Anexar print do plano"}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) onAttachPrint(p, f);
                            }}
                          />
                          <ImageIcon className="h-3.5 w-3.5" />
                        </label>
                      ) : null}
                      {onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(p)}
                          title="Ajustar campos deste plano"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input transition-colors hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : p.planId)}
                        title="Ver cobertura completa"
                        aria-expanded={isOpen}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                      </button>
                    </div>
                  </td>
                </tr>

                {isOpen ? (
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-4 py-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Você paga (rede credenciada)
                      </p>
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3 lg:grid-cols-4">
                        <Detail label="Atenção primária" value={p.atencaoPrimaria} />
                        <Detail label="Especialista" value={p.atencaoEspecialista} />
                        <Detail label="Urgência" value={p.atencaoUrgencia} />
                        <Detail label="Emergência" value={p.emergencia} />
                        <Detail label="Saúde mental" value={p.saudeMental} />
                        <Detail label="Genéricos" value={p.medicamentoGenerico} />
                        <Detail label="Conta HSA" value={p.hsaElegivel == null ? null : p.hsaElegivel ? "Elegível" : "Não elegível"} />
                        <Detail label="Código do plano" value={p.planId} />
                      </dl>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}
