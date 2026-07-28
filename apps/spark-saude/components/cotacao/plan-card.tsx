import { Check, Star } from "lucide-react";
import type { PlanQuote } from "@/lib/cotacao/types";
import { Card } from "@/components/ui/card";
import { formatMoneyBR, cn } from "@/lib/utils";

/** Metal-level accent color — a quiet visual anchor per tier. */
const METAL: Record<string, { bar: string; chip: string; label: string }> = {
  Bronze: { bar: "#B45309", chip: "bg-[rgba(180,83,9,0.10)] text-[#B45309]", label: "Bronze" },
  Silver: { bar: "#64748B", chip: "bg-[rgba(100,116,139,0.12)] text-[#475569]", label: "Silver" },
  Gold: { bar: "#CA8A04", chip: "bg-[rgba(202,138,4,0.12)] text-[#A16207]", label: "Gold" },
  Platinum: { bar: "#4F46E5", chip: "bg-[rgba(79,70,229,0.12)] text-[#4338CA]", label: "Platinum" },
};
const metalOf = (m: string) => METAL[m] ?? { bar: "#98A2B3", chip: "bg-muted text-muted-foreground", label: m };

/** A structured plan card — mirrors the Oscar print fields (§5). Selectable. */
export function PlanCard({
  plan,
  selected,
  best,
  onToggle,
  readOnly = false,
}: {
  plan: PlanQuote;
  selected?: boolean;
  best?: boolean;
  onToggle?: () => void;
  readOnly?: boolean;
}) {
  const metal = metalOf(plan.metalLevel);
  return (
    <Card
      className={cn(
        "relative flex flex-col overflow-hidden p-4 transition-all duration-200",
        !readOnly && "hover:-translate-y-0.5 hover:shadow-card-hover",
        selected && "ring-2 ring-primary",
      )}
    >
      {/* metal accent rail */}
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: metal.bar }} aria-hidden />

      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{plan.nomePlano}</p>
          <p className="truncate text-xs text-muted-foreground">{plan.seguradora}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", metal.chip)}>{metal.label}</span>
      </div>

      {best ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[rgba(18,183,106,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[#0E9F6E]">
          <Star className="h-3 w-3 fill-current" /> Melhor preço
        </span>
      ) : null}

      {/* Prêmio: estimado (com crédito) em destaque + bruto ao lado (§7) */}
      <div className="mt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-semibold leading-none tracking-tight">{formatMoneyBR(plan.premioMensal)}</span>
          <span className="text-xs text-muted-foreground">/mês</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Bruto <span className="font-medium text-foreground">{formatMoneyBR(plan.premioSemCredito)}</span> · crédito{" "}
          <span className="font-medium text-[#0E9F6E]">{formatMoneyBR(plan.creditoFiscal)}</span>
        </p>
      </div>

      <dl className="mt-3 space-y-1.5 border-t pt-3 text-xs">
        <Row label="Dedutível" value={plan.dedutivel != null ? formatMoneyBR(plan.dedutivel) : "—"} strong />
        <Row label="Máx. do bolso" value={plan.maxBolso != null ? formatMoneyBR(plan.maxBolso) : "—"} strong />
        <Row label="Atenção primária" value={plan.atencaoPrimaria} />
        <Row label="Especialista" value={plan.atencaoEspecialista} />
        <Row label="Urgência" value={plan.atencaoUrgencia} />
        <Row label="Emergência" value={plan.emergencia} />
        <Row label="Saúde mental" value={plan.saudeMental} />
        <Row label="Genéricos" value={plan.medicamentoGenerico} />
      </dl>

      {!readOnly && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
            selected ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-input bg-background hover:bg-muted",
          )}
        >
          {selected ? <Check className="h-4 w-4" /> : null}
          {selected ? "Selecionado" : "Selecionar"}
        </button>
      ) : null}
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value?: string | null; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right", strong ? "font-semibold" : "font-medium")}>{value || "—"}</dd>
    </div>
  );
}
