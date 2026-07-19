import { addDays } from "date-fns";
import type {
  Contact,
  OverviewSummary,
  Pipeline,
  PipelineView,
  RenewalItem,
} from "@/lib/types";
import { contactToRenewal, type RenewalWindow } from "../renewals";
import type { TenantConfig } from "../tenant";

/**
 * Development fixtures (CLAUDE.md §8): realistic data to build the layout
 * without hitting the API. Toggled by GHL_USE_FIXTURES=true. The final path is
 * always the real API.
 */

const iso = (days: number) => addDays(new Date(), days).toISOString();

function c(
  id: string,
  name: string,
  tags: string[],
  fields: Contact["fields"],
  extra: Partial<Contact> = {},
): Contact {
  return {
    id,
    name,
    email: `${id}@exemplo.com`,
    phone: "+1 (786) 555-0100",
    tags: ["linha_saude", ...tags],
    dateAdded: iso(-120),
    fields,
    ...extra,
  };
}

export const FIXTURE_CONTACTS: Contact[] = [
  c("ana-souza", "Ana Souza", ["cliente_ativo", "renovacao_pendente"], {
    dataRenovacao: iso(-4), seguradora: "Oscar", planoEscolhido: "Silver 70", monthlyPremium: 312, formaPagamento: "Cartão", documentacaoRecebida: "Sim", pessoasNoSeguro: 2, underwritingStatus: "Aprovado",
  }),
  c("bruno-lima", "Bruno Lima", ["cliente_ativo", "renovacao_avisada"], {
    dataRenovacao: iso(12), seguradora: "Ambetter", planoEscolhido: "Gold 80", monthlyPremium: 445, formaPagamento: "ACH", documentacaoRecebida: "Sim", pessoasNoSeguro: 3,
  }),
  c("carla-mendes", "Carla Mendes", ["cliente_ativo", "renovacao_pendente", "documento_pendente"], {
    dataRenovacao: iso(20), seguradora: "Oscar", planoEscolhido: "Bronze 60", monthlyPremium: 198, documentacaoRecebida: "Parcial", pessoasNoSeguro: 1,
  }),
  c("diego-rocha", "Diego Rocha", ["cliente_ativo"], {
    dataRenovacao: iso(27), seguradora: "Molina", planoEscolhido: "Silver 73", monthlyPremium: 260, documentacaoRecebida: "Sim", pessoasNoSeguro: 4,
  }),
  c("elena-castro", "Elena Castro", ["cliente_ativo", "renovacao_avisada"], {
    dataRenovacao: iso(41), seguradora: "Ambetter", planoEscolhido: "Gold 80", monthlyPremium: 512, documentacaoRecebida: "Sim", pessoasNoSeguro: 2,
  }),
  c("felipe-alves", "Felipe Alves", ["cliente_ativo", "renovacao_feita"], {
    dataRenovacao: iso(55), seguradora: "Oscar", planoEscolhido: "Silver 70", monthlyPremium: 305, documentacaoRecebida: "Sim", pessoasNoSeguro: 1,
  }),
  c("gabriela-nunes", "Gabriela Nunes", ["cliente_ativo", "renovacao_pendente"], {
    dataRenovacao: iso(71), seguradora: "Cigna", planoEscolhido: "Bronze 60", monthlyPremium: 176, documentacaoRecebida: "Não", pessoasNoSeguro: 1,
  }),
  c("henrique-dias", "Henrique Dias", ["cliente_ativo"], {
    dataRenovacao: iso(84), seguradora: "Molina", planoEscolhido: "Gold 80", monthlyPremium: 398, documentacaoRecebida: "Sim", pessoasNoSeguro: 3,
  }),
  c("isabela-reis", "Isabela Reis", ["cliente_ativo", "requer_atencao"], {
    dataRenovacao: iso(150), seguradora: "Oscar", planoEscolhido: "Silver 70", monthlyPremium: 289, documentacaoRecebida: "Sim", pessoasNoSeguro: 2, mainObjection: "Preço acima do orçamento",
  }),
  c("joao-pereira", "João Pereira", ["aplicacao_iniciada", "informacao_pendente"], {
    seguradora: "Ambetter", planoEscolhido: "Silver 73", monthlyPremium: 240, documentacaoRecebida: "Parcial", underwritingStatus: "Pendente", pessoasNoSeguro: 2,
  }),
  c("keila-santos", "Keila Santos", ["aplicacao_em_analise"], {
    seguradora: "Oscar", planoEscolhido: "Bronze 60", monthlyPremium: 205, documentacaoRecebida: "Sim", underwritingStatus: "Em análise", pessoasNoSeguro: 1,
  }),
  c("lucas-martins", "Lucas Martins", ["aplicacao_iniciada"], {
    seguradora: "Cigna", planoEscolhido: "Gold 80", monthlyPremium: 470, documentacaoRecebida: "Não", pessoasNoSeguro: 4,
  }),
  c("marina-lopes", "Marina Lopes", ["lead_novo", "cotacao_solicitada"], {
    pessoasNaCasa: 3, pessoasNoSeguro: 2, rendaCasa: 54000, idioma: "Português",
  }),
  c("natalia-gomes", "Natália Gomes", ["cliente_ativo", "documento_pendente"], {
    dataRenovacao: iso(9), seguradora: "Molina", planoEscolhido: "Silver 70", monthlyPremium: 268, documentacaoRecebida: "Parcial", pessoasNoSeguro: 2,
  }),
];

const FIXTURE_STAGES = {
  acquisition: [
    "New lead",
    "Quote requested",
    "Automatic Follow-up",
    "Quote sent",
    "Option chosen → Application",
    "Awaiting approval",
    "Info pending",
    "Approved",
  ],
  client: ["New Client", "Client active", "Renewal pending", "Renewal done", "Review / plan change", "Client inactive"],
};

function pipeline(id: string, name: string, role: Pipeline["role"], stageNames: string[]): Pipeline {
  return {
    id,
    name,
    role,
    stages: stageNames.map((n, i) => ({ id: `${id}-s${i}`, name: n, position: i })),
  };
}

export const FIXTURE_PIPELINES: Pipeline[] = [
  pipeline("fx-acq", "1. Acquisition", "acquisition", FIXTURE_STAGES.acquisition),
  pipeline("fx-cli", "2. Client", "client", FIXTURE_STAGES.client),
];

const ACQ_COUNTS = [6, 4, 3, 5, 2, 3, 2, 1];
const CLI_COUNTS = [3, 9, 5, 4, 2, 1];

function buildViews(): PipelineView[] {
  return FIXTURE_PIPELINES.map((p) => {
    const counts = p.role === "acquisition" ? ACQ_COUNTS : CLI_COUNTS;
    const buckets = p.stages.map((stage, i) => {
      const n = counts[i] ?? 0;
      const opportunities = Array.from({ length: Math.min(n, 6) }, (_, k) => ({
        id: `${stage.id}-o${k}`,
        name: `Negócio ${stage.name} #${k + 1}`,
        pipelineId: p.id,
        stageId: stage.id,
        status: "open",
        monetaryValue: 200 + k * 35,
      }));
      return { stage, count: n, opportunities };
    });
    const total = buckets.reduce((s, b) => s + b.count, 0);
    return { pipeline: p, buckets, total };
  });
}

export const FIXTURE_PIPELINE_VIEWS: PipelineView[] = buildViews();

export function fixtureRenewals(tenant: TenantConfig, withinDays: RenewalWindow): RenewalItem[] {
  return FIXTURE_CONTACTS.map((c) => contactToRenewal(c, tenant))
    .filter((r): r is RenewalItem => r !== null && r.daysUntil !== null && r.daysUntil <= withinDays)
    .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
}

export function fixtureOverview(tenant: TenantConfig): OverviewSummary {
  const has = (c: Contact, tag: string) => c.tags.includes(tag);
  const count = (tag: string) => FIXTURE_CONTACTS.filter((c) => has(c, tag)).length;
  const renewals60 = fixtureRenewals(tenant, 60);
  const attention = FIXTURE_CONTACTS.filter((c) =>
    tenant.attentionTags.some((t) => c.tags.includes(t)),
  ).slice(0, 12);
  return {
    metrics: [
      { key: "activeClients", label: "Clientes ativos", value: count(tenant.overviewTags.activeClients) },
      { key: "upcomingRenewals", label: "Renovações (60 dias)", value: renewals60.length },
      { key: "applicationsInProgress", label: "Aplicações em andamento", value: count(tenant.overviewTags.applicationsInProgress) },
      { key: "awaitingApproval", label: "Aguardando aprovação", value: count(tenant.overviewTags.awaitingApproval) },
    ],
    attention,
  };
}
