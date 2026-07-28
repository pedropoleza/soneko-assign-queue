import type { PlanQuote } from "@/lib/cotacao/types";

/**
 * Fixture plans for dev / before the CMS key arrives (GHL_USE_FIXTURES=true or
 * no CMS_MARKETPLACE_API_KEY). Values mirror the Oscar prints from the pilot so
 * the UI can be built and reviewed end-to-end. NOT real quotes.
 */
export const FIXTURE_PLANS: PlanQuote[] = [
  {
    planId: "10544FL0010001",
    seguradora: "Oscar",
    nomePlano: "Oscar Silver Simple",
    metalLevel: "Silver",
    premioMensal: 0,
    premioSemCredito: 3087.47,
    creditoFiscal: 3135,
    dedutivel: 5000,
    maxBolso: 9200,
    atencaoPrimaria: "$0 copay",
    atencaoEspecialista: "$50 copay",
    atencaoUrgencia: "$75 copay",
    emergencia: "$500 copay",
    saudeMental: "$0 copay",
    medicamentoGenerico: "$5 copay",
    fonte: "api",
  },
  {
    planId: "10544FL0020002",
    seguradora: "Ambetter",
    nomePlano: "Ambetter Clear Gold",
    metalLevel: "Gold",
    premioMensal: 142.3,
    premioSemCredito: 3277.3,
    creditoFiscal: 3135,
    dedutivel: 1500,
    maxBolso: 7500,
    atencaoPrimaria: "$10 copay",
    atencaoEspecialista: "$40 copay",
    atencaoUrgencia: "$60 copay",
    emergencia: "$400 copay",
    saudeMental: "$10 copay",
    medicamentoGenerico: "$3 copay",
    fonte: "api",
  },
  {
    planId: "10544FL0030003",
    seguradora: "Molina",
    nomePlano: "Molina Bronze 5",
    metalLevel: "Bronze",
    premioMensal: 0,
    premioSemCredito: 2890.11,
    creditoFiscal: 2890.11,
    dedutivel: 8600,
    maxBolso: 9450,
    atencaoPrimaria: "$25 copay",
    atencaoEspecialista: "40% coinsurance",
    atencaoUrgencia: "$90 copay",
    emergencia: "50% coinsurance",
    saudeMental: "$25 copay",
    medicamentoGenerico: "$10 copay",
    fonte: "api",
  },
];
