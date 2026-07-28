import { Check } from "lucide-react";
import type { PlanQuote } from "@/lib/cotacao/types";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { formatMoneyBR, cn } from "@/lib/utils";

const METAL_TONE: Record<string, BadgeProps["tone"]> = {
  Bronze: "amber",
  Silver: "gray",
  Gold: "amber",
  Platinum: "blue",
};

/** A structured plan card — mirrors the Oscar print fields (§5). Selectable. */
export function PlanCard({
  plan,
  selected,
  onToggle,
  readOnly = false,
}: {
  plan: PlanQuote;
  selected?: boolean;
  onToggle?: () => void;
  readOnly?: boolean;
}) {
  return (
    <Card className={cn("flex flex-col p-4 transition-shadow", selected && "ring-2 ring-primary")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{plan.nomePlano}</p>
          <p className="truncate text-xs text-muted-foreground">{plan.seguradora}</p>
        </div>
        <Badge tone={METAL_TONE[plan.metalLevel] ?? "gray"}>{plan.metalLevel}</Badge>
      </div>

      {/* Prêmio: estimado (com crédito) em destaque + bruto ao lado (§7) */}
      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight">{formatMoneyBR(plan.premioMensal)}</span>
          <span className="text-xs text-muted-foreground">/mês estimado</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Sem crédito {formatMoneyBR(plan.premioSemCredito)} · crédito {formatMoneyBR(plan.creditoFiscal)}
        </p>
      </div>

      <dl className="mt-3 space-y-1 border-t pt-3 text-xs">
        <Row label="Dedutível" value={plan.dedutivel != null ? formatMoneyBR(plan.dedutivel) : "—"} />
        <Row label="Máx. do bolso" value={plan.maxBolso != null ? formatMoneyBR(plan.maxBolso) : "—"} />
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

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
