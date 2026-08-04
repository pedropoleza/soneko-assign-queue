import { Check, Star, ZoomIn } from "lucide-react";
import type { PlanQuote } from "@/lib/cotacao/types";
import { metalStyle } from "@/lib/cotacao/metal";
import { formatMoneyBR, cn } from "@/lib/utils";

/**
 * A plan, as both the broker and the client see it (docs/cotacao.md §5, §8).
 *
 * Clean GHL frame + the tier as COLOR, not text to be read: a rail on top, a
 * tinted chip and the premium in the metal's own ink, so a row of plans scans
 * by tier before any word is read. The gross premium and the tax credit sit
 * right under the price — §7 requires an estimate shown as an estimate, never
 * a bare final price. Type floor: 12px.
 */
export function PlanCard({
  plan,
  selected,
  best,
  onToggle,
  readOnly = false,
  printUrl,
}: {
  plan: PlanQuote;
  selected?: boolean;
  best?: boolean;
  onToggle?: () => void;
  readOnly?: boolean;
  printUrl?: string | null;
}) {
  const metal = metalStyle(plan.metalLevel);
  const hasCredit = plan.creditoFiscal > 0;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-card transition-shadow",
        !readOnly && "hover:shadow-card-hover",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      {/* O tier antes de qualquer palavra */}
      <span className="h-1 w-full shrink-0" style={{ background: metal.rail }} aria-hidden />

      <div className="flex flex-1 flex-col p-4">
        {/* Identidade */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            {/* Two lines before truncating — plan names are long and the tier
                is what distinguishes them at a glance, not a cut-off word. */}
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{plan.nomePlano}</h3>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{plan.seguradora}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", metal.chip)}>
            {metal.label}
          </span>
        </div>

        {/* Marcadores */}
        {best || plan.tipoPlano || plan.qualityRating != null ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {best ? (
              <span className="rounded-full bg-status-green-bg px-2 py-0.5 text-xs font-semibold text-status-green-fg">
                Melhor preço
              </span>
            ) : null}
            {plan.tipoPlano ? (
              <span className="rounded-full bg-status-gray-bg px-2 py-0.5 text-xs font-medium text-status-gray-fg">
                {plan.tipoPlano}
              </span>
            ) : null}
            {plan.qualityRating != null ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-status-gray-bg px-2 py-0.5 text-xs font-medium text-status-gray-fg"
                title={`${plan.qualityRating} de 5 estrelas (CMS)`}
              >
                <Star className="h-3 w-3 fill-current text-accent" />
                {plan.qualityRating.toFixed(1)}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Preço — o número que o cliente procura, na cor do tier */}
        <div className="relative -mx-4 mt-3 px-4 py-3" style={{ background: metal.wash }}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-semibold leading-none tracking-tight" style={{ color: metal.ink }}>
              {formatMoneyBR(plan.premioMensal)}
            </span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </div>
          {hasCredit ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              <span className="line-through">{formatMoneyBR(plan.premioSemCredito)}</span>
              <span className="mx-1">·</span>
              <span className="font-semibold text-status-green-fg">−{formatMoneyBR(plan.creditoFiscal)}</span> de
              crédito fiscal
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Sem crédito fiscal estimado</p>
          )}
        </div>

        {/* Números que decidem */}
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <Figure label="Dedutível" value={formatMoneyBR(plan.dedutivel)} />
          <Figure label="Máx. do bolso" value={formatMoneyBR(plan.maxBolso)} />
        </dl>

        {/* Você paga */}
        <div className="mt-3 border-t pt-2.5">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Você paga</p>
          <dl className="space-y-1">
            <Row label="Atenção primária" value={plan.atencaoPrimaria} />
            <Row label="Especialista" value={plan.atencaoEspecialista} />
            <Row label="Urgência" value={plan.atencaoUrgencia} />
            <Row label="Emergência" value={plan.emergencia} />
            <Row label="Saúde mental" value={plan.saudeMental} />
            <Row label="Genéricos" value={plan.medicamentoGenerico} />
          </dl>
        </div>

        {printUrl ? (
          <a
            href={printUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-2.5 rounded-md border bg-muted/40 p-2 text-xs transition-colors hover:bg-muted"
            title="Ver print oficial (ampliar)"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={printUrl} alt="Print do plano" className="h-10 w-10 rounded object-cover ring-1 ring-border" />
            <span className="flex items-center gap-1 font-medium text-muted-foreground">
              <ZoomIn className="h-3.5 w-3.5" /> Ver print da seguradora
            </span>
          </a>
        ) : null}

        {!readOnly && onToggle ? (
          // mt-auto pins the CTA to the bottom so a row of cards lines up even
          // when the cost-sharing text wraps to different heights.
          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                  : "border bg-background shadow-card hover:bg-muted",
              )}
            >
              {selected ? <Check className="h-4 w-4" /> : null}
              {selected ? "Na proposta" : "Adicionar à proposta"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** A headline figure — deductible / out-of-pocket max. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

/**
 * A cost-sharing line. Values here are free text straight from the plan card
 * ("25% coaseguro después del deducible"), so the value column must be allowed
 * to wrap — a fixed leader would clip exactly the rows that matter most.
 */
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-baseline gap-x-3 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium leading-snug">{value || "—"}</dd>
    </div>
  );
}
