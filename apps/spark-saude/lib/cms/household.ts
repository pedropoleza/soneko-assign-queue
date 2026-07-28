import type { QuoteProfile } from "@/lib/cotacao/types";
import type { CmsPlan, CmsSearchRequest } from "./types";
import type { PlanQuote } from "@/lib/cotacao/types";
import { resolveCounty, toCmsPerson } from "./counties";
import { CmsStateNotCoveredError } from "./errors";

/** States NOT on the federal exchange (they run their own marketplace). */
const STATE_BASED_EXCHANGES = new Set([
  "CA", "CO", "CT", "DC", "ID", "KY", "ME", "MD", "MA", "MN", "NV", "NJ", "NM", "NY", "PA", "RI", "VT", "VA", "WA",
]);

/**
 * Build the CMS `/plans/search` request body from the broker's profile,
 * resolving the county FIPS from the zipcode when needed and rejecting states
 * the federal API doesn't cover (CLAUDE.md §3).
 */
export async function buildSearchRequest(profile: QuoteProfile): Promise<CmsSearchRequest> {
  let state = profile.state?.toUpperCase();
  let countyfips = profile.countyfips;

  if (!countyfips || !state) {
    const county = await resolveCounty(profile.zipcode);
    countyfips = countyfips ?? county.countyfips;
    state = state ?? county.state.toUpperCase();
  }

  if (STATE_BASED_EXCHANGES.has(state)) throw new CmsStateNotCoveredError(state);

  return {
    household: {
      income: profile.income,
      people: profile.people.map(toCmsPerson),
    },
    market: "Individual",
    place: { zipcode: profile.zipcode, state, countyfips },
    year: profile.year,
  };
}

const firstAmount = (entries?: Array<{ amount?: number; type?: string }>, ...prefer: string[]): number | null => {
  if (!entries?.length) return null;
  for (const type of prefer) {
    const hit = entries.find((e) => (e.type ?? "").toLowerCase().includes(type.toLowerCase()));
    if (hit?.amount != null) return hit.amount;
  }
  return entries[0]?.amount ?? null;
};

const benefit = (plan: CmsPlan, ...types: string[]): string | null => {
  for (const t of types) {
    const b = plan.benefits?.find((x) => (x.type ?? x.name ?? "").toUpperCase().includes(t));
    const cs = b?.cost_sharings?.find((c) => (c.network_tier ?? "In-Network").toLowerCase().includes("in"));
    if (cs?.display_string) return cs.display_string;
    if (b?.cost_sharings?.[0]?.display_string) return b.cost_sharings[0].display_string!;
  }
  return null;
};

/**
 * Map a raw CMS plan onto the structured PlanQuote (the Oscar-print schema, §5).
 * Best-effort: paths follow the public API shape but MUST be validated against a
 * live response before production (CLAUDE.md §3).
 */
export function mapCmsPlan(plan: CmsPlan): PlanQuote {
  const gross = plan.premium ?? 0;
  const withCredit = plan.premium_w_credit ?? gross;
  return {
    planId: plan.id,
    seguradora: plan.issuer?.name ?? "—",
    nomePlano: plan.name ?? plan.id,
    metalLevel: plan.metal_level ?? "—",
    premioMensal: withCredit,
    premioSemCredito: gross,
    creditoFiscal: Math.max(0, gross - withCredit),
    dedutivel: firstAmount(plan.deductibles, "Combined", "Medical"),
    maxBolso: firstAmount(plan.moops, "Combined", "Medical"),
    atencaoPrimaria: benefit(plan, "PRIMARY_CARE"),
    atencaoEspecialista: benefit(plan, "SPECIALIST"),
    atencaoUrgencia: benefit(plan, "URGENT_CARE"),
    emergencia: benefit(plan, "EMERGENCY_ROOM"),
    saudeMental: benefit(plan, "MENTAL_HEALTH", "MENTAL_BEHAVIORAL"),
    medicamentoGenerico: benefit(plan, "GENERIC_DRUGS", "GENERIC"),
    fonte: "api",
  };
}
