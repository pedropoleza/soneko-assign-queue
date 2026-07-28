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
  | "dataNascimento"
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
  /** Native GHL date of birth (ISO). Feeds exact-age quoting in Cotação. */
  dateOfBirth?: string;
  postalCode?: string;
  state?: string;
  city?: string;
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

export interface ChartDatum {
  label: string;
  value: number;
}

export interface OverviewKpis {
  activeClients: number;
  mrr: number; // monthly recurring revenue (sum of monthly premiums)
  upcomingRenewals: number; // within 60 days
  awaitingApproval: number;
  applicationsInProgress: number;
  totalClients: number; // linha_saude contacts
}

export interface OverviewSummary {
  kpis: OverviewKpis;
  bySeguradora: ChartDatum[];
  byPlano: ChartDatum[];
  docStatus: ChartDatum[];
  renewalsByMonth: ChartDatum[];
  renewalStatus: ChartDatum[];
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

// --- Subaccount activity (Agenda · Conversas · Receita) ---------------------

export interface Appointment {
  id: string;
  calendarId: string;
  calendarName: string;
  contactId?: string;
  title: string;
  status: string; // Novo | Confirmado | Compareceu | No-show | Cancelado
  startTime?: string;
}

export interface AgendaSummary {
  kpis: { total: number; confirmados: number; compareceu: number; noShow: number; cancelados: number };
  byStatus: ChartDatum[];
  byCalendar: ChartDatum[];
  upcoming: Appointment[];
}

export interface ConversationItem {
  id: string;
  contactId?: string;
  name: string;
  channel: string;
  unread: number;
  lastAt?: string;
}

export interface ConversationsSummary {
  kpis: { total: number; unread: number };
  byChannel: ChartDatum[];
  recent: ConversationItem[];
}

export interface OppRevenue {
  kpis: { openValue: number; wonValue: number; openCount: number; wonCount: number };
  byPipeline: ChartDatum[]; // open value per pipeline
  byStatus: ChartDatum[]; // count per status
}

export interface ActivitySummary {
  appointments: AgendaSummary;
  conversations: ConversationsSummary;
  opportunities: OppRevenue;
}

/** A typed error surfaced from the data layer to the route handlers/front. */
export interface ApiErrorShape {
  error: string;
  code?: string;
  status?: number;
}
