import { serverEnv } from "@/lib/config";
import type { PlanQuote, QuoteProfile } from "@/lib/cotacao/types";
import { buildSearchRequest, mapCmsPlan } from "./household";
import { searchPlans } from "./client";
import { FIXTURE_PLANS } from "./__fixtures__/plans";

/**
 * CMS facade consumed by the route handlers (front never imports this). Switches
 * between fixtures and the live Marketplace API. Fixtures kick in when
 * GHL_USE_FIXTURES=true OR no CMS key is configured yet — so the whole flow is
 * buildable and reviewable before the key arrives (it's requested separately and
 * rotates every 60 days).
 */

export interface QuoteSearchResult {
  profile: QuoteProfile;
  plans: PlanQuote[];
  /** True when the numbers are placeholders (no live CMS call was made). */
  usingFixtures: boolean;
  generatedAt: string;
}

export async function getQuoteSearch(profile: QuoteProfile): Promise<QuoteSearchResult> {
  const useFixtures = serverEnv.useFixtures || !serverEnv.cmsApiKey;
  const generatedAt = new Date().toISOString();

  if (useFixtures) {
    return { profile, plans: FIXTURE_PLANS, usingFixtures: true, generatedAt };
  }

  const req = await buildSearchRequest(profile);
  const res = await searchPlans(req);
  const plans = (res.plans ?? []).map(mapCmsPlan);
  return { profile: { ...profile, countyfips: req.place.countyfips, state: req.place.state }, plans, usingFixtures: false, generatedAt };
}
