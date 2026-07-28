import { AlertTriangle, BadgePercent, ShieldCheck } from "lucide-react";
import type { EligibilitySummary } from "@/lib/cms";
import { formatMoneyBR } from "@/lib/utils";

/**
 * The subsidy determination from the CMS eligibility endpoint — the number the
 * whole quote hinges on. Two cases matter beyond the APTC amount:
 *
 *  - **Medicaid/CHIP**: the household is below the subsidy floor and belongs on
 *    Medicaid, not on a Marketplace plan. Selling them one would be a mistake,
 *    so this is a hard warning, not a footnote.
 *  - **CSR**: on Silver plans the client gets reduced copays/deductibles. The
 *    plan rows already reflect it; saying so out loud explains why Silver may
 *    beat Gold for this family.
 */
export function EligibilityBanner({ eligibility }: { eligibility: EligibilitySummary }) {
  if (eligibility.medicaidChip) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-[#F79009]/40 bg-[rgba(247,144,9,0.08)] px-3.5 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B54708]" />
        <div className="text-sm">
          <p className="font-semibold text-[#B54708]">Esta família provavelmente se qualifica para Medicaid/CHIP</p>
          <p className="mt-0.5 text-muted-foreground">
            Com a renda informada, o Marketplace não concede crédito fiscal — o caminho correto é o Medicaid/CHIP
            estadual. Confirme a renda antes de seguir com uma proposta paga.
          </p>
        </div>
      </div>
    );
  }

  const hasAptc = eligibility.aptc != null && eligibility.aptc > 0;
  if (!hasAptc && !eligibility.csr) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[#12B76A]/30 bg-[rgba(18,183,106,0.07)] px-3.5 py-2.5 text-sm">
      {hasAptc ? (
        <span className="inline-flex items-center gap-1.5">
          <BadgePercent className="h-4 w-4 text-[#0E9F6E]" />
          <span className="text-muted-foreground">Crédito fiscal estimado</span>
          <strong className="tabular-nums text-[#0E9F6E]">{formatMoneyBR(eligibility.aptc)}/mês</strong>
        </span>
      ) : null}
      {eligibility.csr ? (
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-[#0E9F6E]" />
          <span className="text-muted-foreground">Redução de custos (CSR)</span>
          <strong className="text-[#0E9F6E]">{eligibility.csr}</strong>
          <span className="text-xs text-muted-foreground">— vale nos planos Silver</span>
        </span>
      ) : null}
    </div>
  );
}
