import { serverEnv } from "@/lib/config";
import { CmsApiError } from "./errors";
import type { CmsHouseholdPerson } from "./types";

/**
 * Resolve `countyfips` from a zipcode. The CMS plan search needs the county FIPS,
 * not just the zip (a zip can span counties). Strategy:
 *   1. A small local table for the pilot's known zips (Broward/FL) — instant.
 *   2. The CMS counties-by-zip endpoint as the general fallback.
 *
 * V1 keeps this narrow and honest: when a zip isn't known locally and no live
 * lookup is available, we surface a clear error instead of guessing a county.
 */

/** Known pilot zips → { countyfips, state }. Extend as the book grows. */
const LOCAL_FIPS: Record<string, { countyfips: string; state: string; county: string }> = {
  // Broward County, FL (Dani's area — the CLAUDE.md example uses 33073).
  "33073": { countyfips: "12011", state: "FL", county: "Broward" },
  "33065": { countyfips: "12011", state: "FL", county: "Broward" },
  "33067": { countyfips: "12011", state: "FL", county: "Broward" },
  "33071": { countyfips: "12011", state: "FL", county: "Broward" },
  "33076": { countyfips: "12011", state: "FL", county: "Broward" },
};

export interface CountyResolution {
  countyfips: string;
  state: string;
  county?: string;
}

export async function resolveCounty(zipcode: string): Promise<CountyResolution> {
  const local = LOCAL_FIPS[zipcode.trim()];
  if (local) return { countyfips: local.countyfips, state: local.state, county: local.county };

  // Live fallback (CMS counties-by-zip). Only attempted when a key exists.
  if (serverEnv.cmsApiKey) {
    const url = `${serverEnv.cmsApiBase}/counties/by/zip/${encodeURIComponent(zipcode)}?apikey=${serverEnv.cmsApiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { counties?: Array<{ fips?: string; state?: string; name?: string }> } | null;
      const c = body?.counties?.[0];
      if (c?.fips && c.state) return { countyfips: c.fips, state: c.state, county: c.name };
    }
  }

  throw new CmsApiError(422, `Não foi possível resolver o county (FIPS) para o CEP ${zipcode}. Informe o county manualmente.`);
}

/** Map a domain person into the CMS household shape. */
export function toCmsPerson(p: {
  age: number;
  gender: "Male" | "Female";
  relationship: string;
  aptcEligible: boolean;
  usesTobacco: boolean;
}): CmsHouseholdPerson {
  return {
    age: p.age,
    gender: p.gender,
    aptc_eligible: p.aptcEligible,
    uses_tobacco: p.usesTobacco,
    relationship: p.relationship,
  };
}
