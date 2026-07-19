import { addDays, addHours } from "date-fns";
import type {
  ActivitySummary,
  Appointment,
  Contact,
  ConversationItem,
  OverviewSummary,
  Pipeline,
  PipelineView,
  RenewalItem,
} from "@/lib/types";
import { contactToRenewal, filterRenewalsByRange, renewalRange } from "../renewals";
import { computeOverview, filterByDateAdded } from "../overview";
import { computeAgenda, computeConversations, computeOppRevenue, type OppLike } from "../activity";
import type { TenantConfig } from "../tenant";

/**
 * Development fixtures (CLAUDE.md §8): realistic data to build the layout
 * without hitting the API. Toggled by GHL_USE_FIXTURES=true. The final path is
 * always the real API.
 */

const iso = (days: number) => addDays(new Date(), days).toISOString();

// Spread entry dates across recent months so the date filter has visible effect.
let __seq = 0;
const ORIGENS = ["origem_indicacao", "origem_whatsapp", "origem_organica"];

function c(
  id: string,
  name: string,
  tags: string[],
  fields: Contact["fields"],
  extra: Partial<Contact> = {},
): Contact {
  const seq = __seq++;
  const daysAgo = 4 + seq * 7;
  return {
    id,
    name,
    email: `${id}@exemplo.com`,
    phone: "+1 (786) 555-0100",
    tags: ["linha_saude", ORIGENS[seq % ORIGENS.length]!, ...tags],
    dateAdded: iso(-daysAgo),
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
  c("otavio-barros", "Otávio Barros", ["cliente_ativo", "renovacao_avisada"], {
    dataRenovacao: iso(63), seguradora: "UnitedHealthcare", planoEscolhido: "Gold 80", monthlyPremium: 534, documentacaoRecebida: "Sim", pessoasNoSeguro: 3,
  }),
  c("paula-freitas", "Paula Freitas", ["cliente_ativo"], {
    dataRenovacao: iso(78), seguradora: "Aetna", planoEscolhido: "Silver 70", monthlyPremium: 296, documentacaoRecebida: "Sim", pessoasNoSeguro: 2,
  }),
  c("rafael-teixeira", "Rafael Teixeira", ["cliente_ativo", "renovacao_pendente"], {
    dataRenovacao: iso(95), seguradora: "Oscar", planoEscolhido: "Bronze 60", monthlyPremium: 189, documentacaoRecebida: "Parcial", pessoasNoSeguro: 1,
  }),
  c("sofia-ramos", "Sofia Ramos", ["cliente_ativo", "renovacao_feita"], {
    dataRenovacao: iso(112), seguradora: "Ambetter", planoEscolhido: "Gold 80", monthlyPremium: 501, documentacaoRecebida: "Sim", pessoasNoSeguro: 4,
  }),
  c("thiago-cardoso", "Thiago Cardoso", ["cliente_ativo"], {
    dataRenovacao: iso(134), seguradora: "Cigna", planoEscolhido: "Silver 73", monthlyPremium: 247, documentacaoRecebida: "Sim", pessoasNoSeguro: 2,
  }),
  c("ursula-melo", "Úrsula Melo", ["cliente_ativo", "renovacao_avisada"], {
    dataRenovacao: iso(150), seguradora: "Molina", planoEscolhido: "Bronze 60", monthlyPremium: 172, documentacaoRecebida: "Não", pessoasNoSeguro: 1,
  }),
  c("vitor-azevedo", "Vitor Azevedo", ["cliente_ativo"], {
    dataRenovacao: iso(46), seguradora: "UnitedHealthcare", planoEscolhido: "Silver 70", monthlyPremium: 318, documentacaoRecebida: "Sim", pessoasNoSeguro: 3,
  }),
  c("wagner-pinto", "Wagner Pinto", ["cliente_ativo", "requer_atencao"], {
    dataRenovacao: iso(38), seguradora: "Oscar", planoEscolhido: "Gold 80", monthlyPremium: 462, documentacaoRecebida: "Parcial", pessoasNoSeguro: 2,
  }),
  c("yara-campos", "Yara Campos", ["cliente_ativo"], {
    dataRenovacao: iso(88), seguradora: "Aetna", planoEscolhido: "Bronze 60", monthlyPremium: 205, documentacaoRecebida: "Sim", pessoasNoSeguro: 1,
  }),
  c("zeca-moura", "Zeca Moura", ["aplicacao_em_analise"], {
    seguradora: "Ambetter", planoEscolhido: "Silver 70", monthlyPremium: 279, documentacaoRecebida: "Parcial", underwritingStatus: "Em análise", pessoasNoSeguro: 2,
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

export function fixtureRenewals(
  tenant: TenantConfig,
  params: { from?: string; to?: string; withinDays?: number },
): RenewalItem[] {
  const items = FIXTURE_CONTACTS.map((c) => contactToRenewal(c, tenant)).filter(
    (r): r is RenewalItem => r !== null,
  );
  const { from, to } = renewalRange(params);
  return filterRenewalsByRange(items, from, to);
}

export function fixtureOverview(tenant: TenantConfig, params: { from?: string; to?: string } = {}): OverviewSummary {
  return computeOverview(filterByDateAdded(FIXTURE_CONTACTS, params.from, params.to), tenant);
}

// --- Activity fixtures (Agenda · Conversas · Receita) -----------------------

const FX_CALS = [
  { id: "cal-1", name: "Consulta Inicial" },
  { id: "cal-2", name: "Apresentação & Fechamento" },
];
const APPT_STATUSES = ["Confirmado", "Novo", "Compareceu", "No-show", "Cancelado", "Confirmado", "Novo", "Compareceu"];

const FIXTURE_APPTS: Appointment[] = Array.from({ length: 18 }, (_, i) => {
  const cal = FX_CALS[i % 2]!;
  const offsetH = (i - 6) * 20; // spread past + future
  return {
    id: `appt-${i}`,
    calendarId: cal.id,
    calendarName: cal.name,
    contactId: FIXTURE_CONTACTS[i % FIXTURE_CONTACTS.length]!.id,
    title: `${cal.name} — ${FIXTURE_CONTACTS[i % FIXTURE_CONTACTS.length]!.name}`,
    status: APPT_STATUSES[i % APPT_STATUSES.length]!,
    startTime: addHours(new Date(), offsetH).toISOString(),
  };
});

const CHANNELS = ["WhatsApp", "SMS", "Email", "Ligação", "WhatsApp", "WhatsApp", "Email"];
const FIXTURE_CONVS: ConversationItem[] = Array.from({ length: 15 }, (_, i) => {
  const c = FIXTURE_CONTACTS[i % FIXTURE_CONTACTS.length]!;
  return {
    id: `conv-${i}`,
    contactId: c.id,
    name: c.name,
    channel: CHANNELS[i % CHANNELS.length]!,
    unread: i % 4 === 0 ? 1 : 0,
    lastAt: addHours(new Date(), -i * 3).toISOString(),
  };
});

const OPP_STATUSES = ["open", "open", "won", "open", "lost", "open", "won", "open"];
const FIXTURE_OPPS: OppLike[] = Array.from({ length: 26 }, (_, i) => ({
  status: OPP_STATUSES[i % OPP_STATUSES.length],
  monetaryValue: 180 + (i % 8) * 45,
  pipelineId: i % 3 === 0 ? "fx-cli" : "fx-acq",
}));

export function fixtureActivity(): ActivitySummary {
  const pipelineNames = new Map(FIXTURE_PIPELINES.map((p) => [p.id, p.name]));
  return {
    appointments: computeAgenda(FIXTURE_APPTS),
    conversations: computeConversations(FIXTURE_CONVS),
    opportunities: computeOppRevenue(FIXTURE_OPPS, pipelineNames),
  };
}
