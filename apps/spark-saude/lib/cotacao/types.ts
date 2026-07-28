/**
 * Cotação Leão — domain types (fase 1).
 *
 * The quotation product lives inside the Spark Saúde app as its own module and
 * shares the GHL data layer ("conectado em nível de informação"). These types
 * are the contract between the CMS Marketplace integration, the persistence
 * layer, the broker-facing builder (Ponta A) and the public proposal (Ponta B).
 * See docs/cotacao.md for the domain rules (source of truth).
 */

export type Gender = "Male" | "Female";
export type Relationship = "Self" | "Spouse" | "Child" | "Dependent";
export type MetalLevel = "Catastrophic" | "Bronze" | "Expanded Bronze" | "Silver" | "Gold" | "Platinum";
export type QuoteStatus = "rascunho" | "enviada" | "respondida";
export type Decision = "aprovado" | "recusado";
/** "api" = came from the CMS; "manual" = the broker typed/adjusted it (hybrid model, §5). */
export type OptionSource = "api" | "manual";

/** A member of the household, as the CMS expects it. */
export interface QuotePerson {
  /** GHL contact this member is linked to (associated to the policyholder). */
  contactId?: string | null;
  contactName?: string | null;
  age: number;
  /**
   * ISO date of birth. When present it is sent INSTEAD of `age`, so the CMS
   * derives the exact age at the coverage effective date — this is what fixes
   * the known "o sistema não reconhece as idades das crianças" distortion
   * (docs/cotacao.md §1), since child rating bands shift the premium sharply.
   */
  dob?: string | null;
  gender: Gender;
  relationship: Relationship;
  aptcEligible: boolean;
  usesTobacco: boolean;
  /** Already covered elsewhere (Medicare/employer) → excluded from the subsidy. */
  hasMec?: boolean;
  isPregnant?: boolean;
  /** Expected medical usage — drives the projected annual out-of-pocket cost. */
  utilizationLevel?: "Low" | "Medium" | "High";
}

/** The broker's input for a quotation — becomes the CMS `household`/`place`/`year`. */
export interface QuoteProfile {
  contactId?: string;
  contactName?: string;
  zipcode: string;
  state: string;
  /** County FIPS — resolved from the zipcode when omitted (lib/cms/counties). */
  countyfips?: string;
  /** Estimated annual household income (drives the APTC subsidy estimate). */
  income: number;
  year: number;
  people: QuotePerson[];
}

/**
 * A structured plan card. Mirrors exactly the fields on the Oscar prints (§5):
 * premium, premium-before-credit, tax credit, deductible, out-of-pocket max, and
 * the "Usted paga" cost-sharing table. Money is in USD; null = not provided.
 */
export interface PlanQuote {
  planId: string;
  seguradora: string;
  nomePlano: string;
  metalLevel: MetalLevel | string;
  /** Estimated monthly premium AFTER the tax credit (the headline "$X/mês"). */
  premioMensal: number;
  /** Gross monthly premium BEFORE the credit (always shown alongside, §7). */
  premioSemCredito: number;
  /** Estimated monthly APTC applied. */
  creditoFiscal: number;
  dedutivel: number | null;
  maxBolso: number | null;
  atencaoPrimaria: string | null;
  atencaoEspecialista: string | null;
  atencaoUrgencia: string | null;
  emergencia: string | null;
  saudeMental: string | null;
  medicamentoGenerico: string | null;
  /** Plan design — HMO / PPO / EPO / POS. A real decision driver for the client. */
  tipoPlano?: string | null;
  /** CMS star rating (1–5); null when the plan is too new to be rated. */
  qualityRating?: number | null;
  hsaElegivel?: boolean | null;
  /** Projected ANNUAL out-of-pocket cost for this household's utilization (oopc). */
  custoAnualEstimado?: number | null;
  fonte: OptionSource;
}

/** A draft option in the builder — a plan (CMS or manual) plus an optional print. */
export type PlanOptionDraft = PlanQuote & { printUrl?: string | null };

/** A plan the broker chose to propose, within a quote (persisted). */
export interface QuoteOption extends PlanQuote {
  id: string;
  quoteId: string;
  /** Private, signed URL of the attached print (respaldo visual, §6). */
  printUrl?: string | null;
  response?: QuoteOptionResponse | null;
}

/** The client's decision on one option (Ponta B). */
export interface QuoteOptionResponse {
  id: string;
  quoteOptionId: string;
  decisao: Decision;
  comentario?: string | null;
  respondidoEm: string;
}

/** A quotation (persisted). `options` is populated when read with its plans. */
export interface Quote {
  id: string;
  ghlContactId?: string | null;
  corretoraId: string;
  createdAt: string;
  zipcode: string;
  state: string;
  countyfips?: string | null;
  income: number;
  year: number;
  status: QuoteStatus;
  /** Signed token for the public proposal link (§6). */
  proposalToken: string;
  tokenExpiresAt: string;
  /** The exact household JSON sent to the CMS (audit + regenerate). */
  householdJson: unknown;
  /** Plan the broker chose to highlight to the client. */
  recommendedPlanId?: string | null;
  options: QuoteOption[];
}

/**
 * The public proposal, as Ponta B receives it (no internal ids / audit fields).
 * Rendered on the branded /proposta/[token] page.
 */
export interface PublicProposal {
  quoteId: string;
  corretora: BrandConfig;
  createdAt: string;
  year: number;
  expired: boolean;
  /** Plan the broker highlighted — shown as "recomendada" to the client. */
  recommendedPlanId?: string | null;
  options: QuoteOption[];
}

/** Broker brand — parametrizable for resale (§8). Default is Leão Insurances. */
export interface BrandConfig {
  name: string;
  tagline: string;
  logoUrl?: string;
  /** Primary navy (#1B2A4A for Leão). */
  primary: string;
  primaryDeep: string;
  secondary: string;
  /** The mandatory estimate disclaimer shown on the proposal (§7). */
  disclaimer: string;
}
