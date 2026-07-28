import type { PlanQuote, QuoteProfile } from "@/lib/cotacao/types";
import type { CmsCostEntry, CmsPlan, CmsSearchRequest, CmsHousehold } from "./types";
import { resolveCounty, toCmsPerson } from "./counties";
import { CmsStateNotCoveredError } from "./errors";

/**
 * States NOT on the federal exchange — 20 states + DC run their own platform for
 * plan year 2026, so HealthCare.gov's API has no plans for them. Georgia moved
 * off in 2025 and Illinois in 2026; Arkansas and Oregon are state-based but
 * still RUN ON the federal platform, so they stay quotable here.
 * Revisit each Open Enrollment — Oregon is slated to leave for PY2027.
 */
const STATE_BASED_EXCHANGES = new Set([
  "CA", "CO", "CT", "DC", "GA", "ID", "IL", "KY", "ME", "MD", "MA",
  "MN", "NV", "NJ", "NM", "NY", "PA", "RI", "VT", "VA", "WA",
]);

/**
 * Coverage effective date. Marketplace plans start on Jan 1 of the plan year for
 * Open Enrollment; quoting a year already underway (a Special Enrollment) starts
 * the first of next month. The API uses this to compute each person's exact age.
 */
export function effectiveDateFor(year: number, today = new Date()): string {
  if (year > today.getFullYear()) return `${year}-01-01`;
  const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

/** The married-couple rule changes the APTC math — derive it from the household. */
function hasMarriedCouple(people: QuoteProfile["people"]): boolean {
  return people.some((p) => p.relationship === "Spouse");
}

export function buildHousehold(profile: QuoteProfile): CmsHousehold {
  return {
    income: profile.income,
    people: profile.people.map(toCmsPerson),
    effective_date: effectiveDateFor(profile.year),
    has_married_couple: hasMarriedCouple(profile.people),
    unemployment_received: "None",
  };
}

export interface BuildOptions {
  /** Server-side ordering — cheaper and more correct than sorting a page locally. */
  sort?: CmsSearchRequest["sort"];
  limit?: number;
  offset?: number;
  metalLevels?: string[];
}

/**
 * Build the CMS `/plans/search` request from the broker's profile, resolving the
 * county FIPS from the zipcode when needed and rejecting states the federal API
 * doesn't cover (docs/cotacao.md §3).
 */
export async function buildSearchRequest(profile: QuoteProfile, opts: BuildOptions = {}): Promise<CmsSearchRequest> {
  let state = profile.state?.toUpperCase();
  let countyfips = profile.countyfips;

  if (!countyfips || !state) {
    const county = await resolveCounty(profile.zipcode);
    countyfips = countyfips ?? county.countyfips;
    state = state ?? county.state.toUpperCase();
  }

  if (STATE_BASED_EXCHANGES.has(state!)) throw new CmsStateNotCoveredError(state!);

  const req: CmsSearchRequest = {
    household: buildHousehold(profile),
    market: "Individual",
    place: { zipcode: profile.zipcode, state: state!, countyfips: countyfips! },
    year: profile.year,
    sort: opts.sort ?? "premium",
    limit: opts.limit ?? 50,
    offset: opts.offset ?? 0,
  };
  if (opts.metalLevels?.length) req.filter = { metal_levels: opts.metalLevels };
  return req;
}

// --- Response mapping --------------------------------------------------------

const isInNetwork = (tier?: string) => {
  const t = (tier ?? "").toLowerCase();
  return !t || t.includes("in") || t.includes("combined");
};

/**
 * Pick the right deductible/MOOP row. The payload splits these by network tier
 * and by individual-vs-family — a family of four must see the FAMILY figure, so
 * reading `entries[0]` blindly would understate their real exposure.
 */
function pickAmount(entries: CmsCostEntry[] | undefined, familySize: number): number | null {
  if (!entries?.length) return null;
  const wantFamily = familySize > 1;

  const inNetwork = entries.filter((e) => isInNetwork(e.network_tier));
  const pool = inNetwork.length ? inNetwork : entries;

  const byFamily = pool.filter((e) => {
    const fc = (e.family_cost ?? "").toLowerCase();
    if (!fc) return true;
    return wantFamily ? fc.includes("family") : !fc.includes("family");
  });
  const scoped = byFamily.length ? byFamily : pool;

  // Prefer the combined medical+drug figure — that's the headline number.
  for (const want of ["combined medical and drug", "medical"]) {
    const hit = scoped.find((e) => (e.type ?? "").toLowerCase().includes(want));
    if (hit?.amount != null) return hit.amount;
  }
  return scoped.find((e) => e.amount != null)?.amount ?? null;
}

/**
 * Read a benefit's cost-sharing string. When the household qualifies for a CSR
 * variant (Silver only), the plan's real cost sharing is the CSR row — showing
 * the base row would quote copays the client will never actually pay.
 */
function benefit(plan: CmsPlan, csr: string | null, ...types: string[]): string | null {
  for (const t of types) {
    const b = plan.benefits?.find((x) => (x.type ?? x.name ?? "").toUpperCase().includes(t));
    if (!b?.cost_sharings?.length) continue;
    const inNet = b.cost_sharings.filter((c) => isInNetwork(c.network_tier));
    const pool = inNet.length ? inNet : b.cost_sharings;
    const match = csr ? pool.find((c) => (c.csr ?? "").toLowerCase() === csr.toLowerCase()) : null;
    const row = match ?? pool.find((c) => !c.csr) ?? pool[0];
    if (row?.display_string) return row.display_string;
  }
  return null;
}

export interface MapOptions {
  familySize: number;
  /** CSR variant the household qualifies for, from the eligibility call. */
  csr?: string | null;
}

/**
 * Map a raw CMS plan onto the structured PlanQuote (the Oscar-print schema, §5),
 * carrying the fields a broker actually compares on: design (HMO/PPO), CMS star
 * rating, HSA eligibility and the projected annual out-of-pocket cost.
 */
export function mapCmsPlan(plan: CmsPlan, opts: MapOptions): PlanQuote {
  const gross = plan.premium ?? 0;
  const withCredit = plan.premium_w_credit ?? gross;
  const csr = opts.csr ?? null;
  return {
    planId: plan.id,
    seguradora: plan.issuer?.name ?? "—",
    nomePlano: plan.name ?? plan.id,
    metalLevel: plan.metal_level ?? "—",
    premioMensal: withCredit,
    premioSemCredito: gross,
    creditoFiscal: Math.max(0, gross - withCredit),
    dedutivel: pickAmount(plan.deductibles, opts.familySize),
    maxBolso: pickAmount(plan.moops, opts.familySize),
    atencaoPrimaria: benefit(plan, csr, "PRIMARY_CARE"),
    atencaoEspecialista: benefit(plan, csr, "SPECIALIST"),
    atencaoUrgencia: benefit(plan, csr, "URGENT_CARE"),
    emergencia: benefit(plan, csr, "EMERGENCY_ROOM", "EMERGENCY"),
    saudeMental: benefit(plan, csr, "MENTAL_HEALTH", "MENTAL_BEHAVIORAL"),
    medicamentoGenerico: benefit(plan, csr, "GENERIC_DRUGS", "GENERIC"),
    tipoPlano: plan.type ?? null,
    qualityRating: plan.quality_rating?.global_rating ?? null,
    hsaElegivel: plan.hsa_eligible ?? null,
    custoAnualEstimado: plan.oopc ?? null,
    fonte: "api",
  };
}
