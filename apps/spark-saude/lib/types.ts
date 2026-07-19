/**
 * Domain types for the Spark Saúde dashboard (CLAUDE.md §3, §4, §8).
 * These model the health-insurance brokerage domain, decoupled from GHL's raw
 * API payloads — the `lib/ghl/` layer normalizes GHL responses into these.
 */

export type PipelineRole = "acquisition" | "client";

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

export interface Pipeline {
  id: string;
  name: string;
  /** Resolved from tenant config (acquisition vs client). null if unknown. */
  role: PipelineRole | null;
  stages: PipelineStage[];
}

export interface CustomFieldDef {
  id: string;
  /** e.g. "contact.data_renovao" — GHL's (accent-mangled) key. */
  fieldKey: string;
  name: string;
  dataType: string;
  model?: string;
}

/** Semantic field keys used across the app (mapped to real GHL fieldKeys per tenant). */
export type SemanticField =
  | "dataRenovacao"
  | "validoAPartir"
  | "policyStartDate"
  | "nextPolicyAnniversary"
  | "nextFollowup"
  | "seguradora"
  | "planoEscolhido"
  | "formaPagamento"
  | "monthlyPremium"
  | "documentacaoRecebida"
  | "underwritingStatus"
  | "pessoasNaCasa"
  | "pessoasNoSeguro"
  | "rendaCasa"
  | "idioma"
  | "beneficiario"
  | "primaryBeneficiary"
  | "intencaoRenovar"
  | "motivoNaoRenovar"
  | "mudouRenda"
  | "mudouEndereco"
  | "mudouDependentes"
  | "mainObjection"
  | "submittedProposal";

export type ContactFields = Partial<Record<SemanticField, string | number>>;

export interface Contact {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags: string[];
  dateAdded?: string;
  dateUpdated?: string;
  fields: ContactFields;
}

/** Renewal status is derived from renewal tags (CLAUDE.md §5). */
export type RenewalStatus = "avisado" | "pendente" | "feito" | "nao_renovou" | "sem_status";

export interface RenewalItem {
  contactId: string;
  name: string;
  email?: string;
  phone?: string;
  seguradora?: string;
  planoEscolhido?: string;
  monthlyPremium?: number;
  dataRenovacao?: string;
  /** Days from today to renewal date; negative = overdue; null = no date. */
  daysUntil: number | null;
  status: RenewalStatus;
  tags: string[];
}

export interface Opportunity {
  id: string;
  name: string;
  contactId?: string;
  pipelineId: string;
  stageId: string;
  status?: string;
  monetaryValue?: number;
}

export interface StageBucket {
  stage: PipelineStage;
  count: number;
  opportunities: Opportunity[];
}

export interface PipelineView {
  pipeline: Pipeline;
  buckets: StageBucket[];
  total: number;
}

export interface OverviewMetric {
  key: string;
  label: string;
  value: number;
  hint?: string;
}

export interface OverviewSummary {
  metrics: OverviewMetric[];
  attention: Contact[];
}

export interface Cursor {
  startAfter?: number;
  startAfterId?: string;
  /** Cursor for POST /contacts/search pagination (the last contact's searchAfter). */
  searchAfter?: (string | number)[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  nextCursor: Cursor | null;
}

/** A typed error surfaced from the data layer to the route handlers/front. */
export interface ApiErrorShape {
  error: string;
  code?: string;
  status?: number;
}
