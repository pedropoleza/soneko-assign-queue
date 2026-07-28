import { serverEnv } from "@/lib/config";
import type { PlanQuote, QuoteProfile } from "@/lib/cotacao/types";
import { buildHousehold, buildSearchRequest, mapCmsPlan, type BuildOptions } from "./household";
import { cmsRateLimitSnapshot, estimateEligibility, hasCmsKey, searchPlans } from "./client";
import { resolveCounty } from "./counties";
import { FIXTURE_PLANS } from "./__fixtures__/plans";

/**
 * CMS facade consumed by the route handlers (the front never imports this).
 * Switches between fixtures and the live Marketplace API — fixtures kick in when
 * GHL_USE_FIXTURES=true OR no CMS key is configured, so the flow stays reviewable
 * before the key arrives (it rotates every 60 days).
 *
 * A live search is TWO calls made in parallel: `/plans/search` for the plans and
 * `/households/eligibility/estimates` for the authoritative subsidy. The second
 * is what tells us the real APTC, the CSR variant (which changes the copays we
 * display) and whether this family should be on Medicaid/CHIP instead.
 */

export interface EligibilitySummary {
  /** Monthly APTC the household is estimated to receive. */
  aptc: number | null;
  /** Cost-sharing-reduction variant (Silver only), e.g. "Silver 87%". */
  csr: string | null;
  /** True when the household belongs on Medicaid/CHIP — do not sell them a plan. */
  medicaidChip: boolean;
  hardshipExemption: boolean;
}

export interface QuoteSearchResult {
  profile: QuoteProfile;
  plans: PlanQuote[];
  /** True when the numbers are placeholders (no live CMS call was made). */
  usingFixtures: boolean;
  generatedAt: string;
  /** Total matching plans in the rate area (the page shows `plans.length`). */
  total: number;
  eligibility: EligibilitySummary | null;
  county: string | null;
  /** Remaining CMS rate-limit budget, when the API reports it. */
  rateLimit: { remaining: number | null; limit: number | null };
}

const EMPTY_ELIGIBILITY: EligibilitySummary = { aptc: null, csr: null, medicaidChip: false, hardshipExemption: false };

export async function getQuoteSearch(profile: QuoteProfile, opts: BuildOptions = {}): Promise<QuoteSearchResult> {
  const useFixtures = serverEnv.useFixtures || !hasCmsKey();
  const generatedAt = new Date().toISOString();

  if (useFixtures) {
    return {
      profile,
      plans: FIXTURE_PLANS,
      usingFixtures: true,
      generatedAt,
      total: FIXTURE_PLANS.length,
      eligibility: null,
      county: null,
      rateLimit: { remaining: null, limit: null },
    };
  }

  const req = await buildSearchRequest(profile, opts);
  const place = req.place;

  // Both calls describe the same household — fire them together.
  const [searchRes, eligibilityRes] = await Promise.all([
    searchPlans(req),
    estimateEligibility({
      household: buildHousehold(profile),
      market: "Individual",
      place,
      year: profile.year,
    }).catch(() => null), // Eligibility is enrichment; never fail the whole quote on it.
  ]);

  const estimate = eligibilityRes?.estimates?.[0];
  const eligibility: EligibilitySummary = estimate
    ? {
        aptc: estimate.aptc ?? null,
        csr: estimate.csr ?? null,
        medicaidChip: Boolean(estimate.is_medicaid_chip),
        hardshipExemption: Boolean(estimate.hardship_exemption),
      }
    : EMPTY_ELIGIBILITY;

  const familySize = profile.people.length;
  const plans = (searchRes.plans ?? []).map((p) => mapCmsPlan(p, { familySize, csr: eligibility.csr }));

  // The county name is worth echoing back — it proves WHICH rate area was priced.
  let county: string | null = null;
  try {
    county = (await resolveCounty(profile.zipcode)).county ?? null;
  } catch {
    county = null;
  }

  return {
    profile: { ...profile, countyfips: place.countyfips, state: place.state },
    plans,
    usingFixtures: false,
    generatedAt,
    total: searchRes.total ?? plans.length,
    eligibility,
    county,
    rateLimit: cmsRateLimitSnapshot(),
  };
}
