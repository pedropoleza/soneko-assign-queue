import { CmsApiError } from "./errors";
import { countiesByZip, hasCmsKey } from "./client";
import type { CmsHouseholdPerson } from "./types";

/**
 * Resolve `countyfips` from a zipcode. The CMS plan search prices by rate area,
 * which is keyed on the county — not the zip (a zip can span several counties).
 *
 * Live-first: we ask the CMS `/counties/by/zip` endpoint, which is authoritative
 * and covers every zip in the federal marketplace. The small local table is only
 * a cache/fallback for the pilot's own area so a missing key or a CMS hiccup
 * doesn't block the broker on her most common zips.
 */

/** Cached pilot zips → county. Fallback only; the live lookup wins. */
const LOCAL_FIPS: Record<string, { countyfips: string; state: string; county: string }> = {
  // Broward County, FL (Dani's area — the docs/cotacao.md example uses 33073).
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
  /** True when the zip maps to more than one county — the broker must confirm. */
  ambiguous?: boolean;
  /** All candidates, when ambiguous. */
  options?: Array<{ countyfips: string; state: string; county?: string }>;
}

const cache = new Map<string, CountyResolution>();

export async function resolveCounty(zipcode: string): Promise<CountyResolution> {
  const zip = zipcode.trim();
  const cached = cache.get(zip);
  if (cached) return cached;

  if (hasCmsKey()) {
    try {
      const body = await countiesByZip(zip);
      const counties = (body.counties ?? []).filter((c) => c.fips && c.state);
      if (counties.length) {
        const options = counties.map((c) => ({
          countyfips: c.fips!,
          state: c.state!.toUpperCase(),
          county: c.name,
        }));
        const resolution: CountyResolution = {
          ...options[0],
          ambiguous: options.length > 1,
          options,
        };
        cache.set(zip, resolution);
        return resolution;
      }
    } catch {
      // Fall through to the local table — a CMS outage shouldn't block a known zip.
    }
  }

  const local = LOCAL_FIPS[zip];
  if (local) return { countyfips: local.countyfips, state: local.state, county: local.county };

  throw new CmsApiError(
    422,
    `Não foi possível resolver o county (FIPS) para o CEP ${zip}. Confirme o CEP ou informe o county manualmente.`,
  );
}

/**
 * Map a domain person into the CMS household shape. Sends `dob` whenever the
 * birth date is known — the API then derives the exact age at the effective
 * date, which is what makes child pricing correct (docs/cotacao.md §1).
 */
export function toCmsPerson(p: {
  age: number;
  dob?: string | null;
  gender: "Male" | "Female";
  relationship: string;
  aptcEligible: boolean;
  usesTobacco: boolean;
  hasMec?: boolean;
  isPregnant?: boolean;
  isParent?: boolean;
  utilizationLevel?: "Low" | "Medium" | "High";
}): CmsHouseholdPerson {
  const person: CmsHouseholdPerson = {
    aptc_eligible: p.aptcEligible,
    gender: p.gender,
    uses_tobacco: p.usesTobacco,
    relationship: p.relationship,
    utilization_level: p.utilizationLevel ?? "Medium",
  };
  if (p.dob) person.dob = p.dob;
  else person.age = p.age;
  if (p.hasMec) person.has_mec = true;
  if (p.isPregnant) person.is_pregnant = true;
  if (p.isParent) person.is_parent = true;
  return person;
}
