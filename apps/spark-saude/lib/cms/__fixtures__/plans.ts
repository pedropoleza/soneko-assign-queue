import type { PlanQuote } from "@/lib/cotacao/types";

/**
 * Fixture plans for dev / before the CMS key arrives (GHL_USE_FIXTURES=true or
 * no CMS_MARKETPLACE_API_KEY).
 *
 * Transcribed from the broker's own HealthCare.gov screenshots for the pilot
 * household (4 pessoas, zip 33073, US$33.000/ano), so the layout is exercised
 * against numbers that actually occur — including the case where the tax credit
 * exceeds the gross premium and the monthly cost lands at $0.00.
 * NOT real quotes.
 */
export const FIXTURE_PLANS: PlanQuote[] = [
  {
    planId: "21525FL0020015",
    seguradora: "Oscar Health Maintenance Organization of Florida",
    nomePlano: "Gold Classic Standard",
    metalLevel: "Gold",
    // Crédito ($3.135) maior que o prêmio bruto ($3.087,47) → $0,00/mês.
    premioMensal: 0,
    premioSemCredito: 3087.47,
    creditoFiscal: 3135,
    dedutivel: 4000,
    maxBolso: 16400,
    atencaoPrimaria: "$30 por visita desde el día 1",
    atencaoEspecialista: "$60 por visita desde el día 1",
    atencaoUrgencia: "$45 por visita desde el día 1",
    emergencia: "25% coaseguro después del deducible",
    saudeMental: "$30 por visita desde el día 1",
    medicamentoGenerico: "$15",
    tipoPlano: "HMO",
    qualityRating: 4,
    hsaElegivel: false,
    custoAnualEstimado: null,
    fonte: "api",
  },
  {
    planId: "21525FL0020012",
    seguradora: "Oscar Health Maintenance Organization of Florida",
    nomePlano: "Silver Simple PCP Saver CSR 150",
    metalLevel: "Silver",
    premioMensal: 87.91,
    premioSemCredito: 3222.91,
    creditoFiscal: 3135,
    dedutivel: 0,
    maxBolso: 3500,
    atencaoPrimaria: "$5 por visita desde el día 1",
    atencaoEspecialista: "$15 por visita desde el día 1",
    atencaoUrgencia: "$30 por visita desde el día 1",
    emergencia: "20%",
    saudeMental: "$5 por visita desde el día 1",
    medicamentoGenerico: "Sin cargo",
    tipoPlano: "HMO",
    qualityRating: 4,
    hsaElegivel: false,
    custoAnualEstimado: null,
    fonte: "api",
  },
  {
    planId: "21525FL0030003",
    seguradora: "Molina Healthcare of Florida",
    nomePlano: "Molina Constant Care Bronze",
    metalLevel: "Bronze",
    premioMensal: 0,
    premioSemCredito: 2890.11,
    creditoFiscal: 2890.11,
    dedutivel: 8600,
    maxBolso: 9450,
    atencaoPrimaria: "$25 por visita desde el día 1",
    atencaoEspecialista: "40% coaseguro después del deducible",
    atencaoUrgencia: "$90 por visita desde el día 1",
    emergencia: "50% coaseguro después del deducible",
    saudeMental: "$25 por visita desde el día 1",
    medicamentoGenerico: "$10",
    tipoPlano: "HMO",
    qualityRating: null,
    hsaElegivel: true,
    custoAnualEstimado: null,
    fonte: "api",
  },
];
