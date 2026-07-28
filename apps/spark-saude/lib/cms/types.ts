/**
 * CMS Marketplace API wire types (developer.cms.gov/marketplace-api/api-spec).
 *
 * These mirror the REAL contract of the HealthCare.gov Marketplace API — the
 * same service that powers the official plan finder. Field names are snake_case
 * exactly as the API expects/returns them; the mapping to our camelCase domain
 * types lives in `household.ts`.
 */

/**
 * A household member. The API accepts EITHER `age` OR `dob` — and `dob` is what
 * makes a quote accurate: the API derives the exact age at the plan's effective
 * date, which is precisely what fixes the broker's known caveat that "durante a
 * cotação o sistema não reconhece as idades das crianças" (docs/cotacao.md §1).
 * Child rating bands (0-14, 15, 16, 17, 18, 19, 20…) shift the premium a lot, so
 * we always send `dob` when the birth date is known and fall back to `age`.
 */
export interface CmsHouseholdPerson {
  age?: number;
  /** ISO-8601 YYYY-MM-DD. Preferred over `age` — exact age at effective_date. */
  dob?: string;
  aptc_eligible: boolean;
  gender: "Male" | "Female";
  uses_tobacco: boolean;
  relationship?: string;
  /** Already has minimum essential coverage → not APTC eligible. */
  has_mec?: boolean;
  is_pregnant?: boolean;
  is_parent?: boolean;
  does_not_cohabitate?: boolean;
  /** Drives the out-of-pocket-cost (oopc) projection. */
  utilization_level?: "Low" | "Medium" | "High";
}

export interface CmsHousehold {
  income: number;
  people: CmsHouseholdPerson[];
  /** ISO date the coverage starts — anchors age + subsidy math. */
  effective_date?: string;
  /** The married-couple rule changes APTC; required for an accurate estimate. */
  has_married_couple?: boolean;
  unemployment_received?: "Adult" | "Dependent" | "None";
}

export interface CmsPlace {
  zipcode: string;
  state: string;
  countyfips: string;
}

/** Server-side result ordering — we ask the API to sort instead of sorting locally. */
export type CmsSort = "premium" | "deductible" | "oopc" | "total_costs" | "quality_rating";

export interface CmsSearchFilter {
  metal_levels?: string[];
  issuers?: string[];
  design_types?: string[];
  hsa_eligible?: boolean;
  /** Premium ceiling, in dollars. */
  premium?: { max?: number; min?: number };
}

export interface CmsSearchRequest {
  household: CmsHousehold;
  market: "Individual" | "SHOP" | "Any";
  place: CmsPlace;
  year: number;
  filter?: CmsSearchFilter;
  sort?: CmsSort;
  offset?: number;
  limit?: number;
}

/**
 * A `deductible`/`moop` entry. The real payload splits these by network tier and
 * by individual-vs-family, so a family quote must read the Family row — reading
 * the first entry blindly is how you show a $1,500 deductible to a family whose
 * real deductible is $3,000.
 */
export interface CmsCostEntry {
  amount?: number;
  type?: string;
  network_tier?: string;
  /** "Individual" | "Family" */
  family_cost?: string;
  csr?: string;
}

/** A benefit's cost-sharing row (the "Usted paga" table on the prints). */
export interface CmsBenefit {
  type?: string;
  name?: string;
  covered?: boolean;
  has_limits?: boolean;
  cost_sharings?: Array<{
    display_string?: string;
    network_tier?: string;
    /** CSR variant this row applies to; base plan rows use a default variant. */
    csr?: string;
    coinsurance_rate?: number;
    copay_amount?: number;
  }>;
}

export interface CmsIssuer {
  id?: string;
  name?: string;
  toll_free?: string;
  state?: string;
}

export interface CmsQualityRating {
  /** CMS star rating, 1–5. `null`/absent when the plan is too new to be rated. */
  global_rating?: number | null;
  clinical_quality_management?: number | null;
  enrollee_experience?: number | null;
  plan_efficiency?: number | null;
}

export interface CmsPlan {
  id: string;
  name?: string;
  issuer?: CmsIssuer;
  metal_level?: string;
  /** Plan design: HMO / PPO / EPO / POS. */
  type?: string;
  /** Gross monthly premium (before any credit). */
  premium?: number;
  /** Monthly premium after the estimated APTC. */
  premium_w_credit?: number;
  deductibles?: CmsCostEntry[];
  moops?: CmsCostEntry[];
  benefits?: CmsBenefit[];
  quality_rating?: CmsQualityRating;
  hsa_eligible?: boolean;
  /** Projected annual out-of-pocket cost for this household's utilization. */
  oopc?: number;
  state?: string;
  service_area_id?: string;
  /** Present on Silver plans when the household qualifies for cost-sharing reductions. */
  has_csr?: boolean;
}

export interface CmsSearchResponse {
  plans?: CmsPlan[];
  total?: number;
  rate_area?: number;
  /** Facet ranges the API returns for the result set (premium/deductible bounds). */
  ranges?: Record<string, unknown>;
  [k: string]: unknown;
}

// --- Eligibility -------------------------------------------------------------

export interface CmsEligibilityRequest {
  household: CmsHousehold;
  market: "Individual";
  place: CmsPlace;
  year: number;
}

/**
 * The authoritative subsidy determination. `aptc` is the monthly tax credit the
 * household is estimated to receive; `csr` is the cost-sharing-reduction variant
 * (Silver-only); `is_medicaid_chip` means this family should NOT be quoted a
 * Marketplace plan at all — they belong on Medicaid/CHIP.
 */
export interface CmsEligibilityEstimate {
  aptc?: number;
  csr?: string;
  hardship_exemption?: boolean;
  is_medicaid_chip?: boolean;
}

export interface CmsEligibilityResponse {
  estimates?: CmsEligibilityEstimate[];
  [k: string]: unknown;
}

// --- Geography ---------------------------------------------------------------

export interface CmsCounty {
  fips?: string;
  name?: string;
  state?: string;
  zipcode?: string;
}

export interface CmsCountiesResponse {
  counties?: CmsCounty[];
}
