/**
 * CMS Marketplace API wire types (subset we consume).
 *
 * The full response is large; we type only what maps onto PlanQuote. Field
 * paths follow the public HealthCare.gov Marketplace API — CONFIRM against the
 * official docs before wiring live (CLAUDE.md §3: "a doc oficial manda").
 */

export interface CmsHouseholdPerson {
  age: number;
  gender: "Male" | "Female";
  aptc_eligible: boolean;
  uses_tobacco: boolean;
  relationship?: string;
}

export interface CmsSearchRequest {
  household: { income: number; people: CmsHouseholdPerson[] };
  market: "Individual";
  place: { zipcode: string; state: string; countyfips: string };
  year: number;
}

/** A `deductible`/`moop` cost entry from the plan payload. */
export interface CmsCostEntry {
  amount?: number;
  type?: string;
  family_cost?: string;
  csr?: string;
}

/** A benefit's cost-sharing row (the "Usted paga" table). */
export interface CmsBenefit {
  type?: string;
  name?: string;
  cost_sharings?: Array<{ display_string?: string; network_tier?: string; csr?: string }>;
}

export interface CmsPlan {
  id: string;
  name?: string;
  issuer?: { name?: string };
  metal_level?: string;
  /** Gross premium (before credit). */
  premium?: number;
  /** Premium after the estimated APTC credit. */
  premium_w_credit?: number;
  deductibles?: CmsCostEntry[];
  moops?: CmsCostEntry[];
  benefits?: CmsBenefit[];
}

export interface CmsSearchResponse {
  plans?: CmsPlan[];
  total?: number;
  /** APTC / rate limit metadata may also appear here — kept loose on purpose. */
  [k: string]: unknown;
}
