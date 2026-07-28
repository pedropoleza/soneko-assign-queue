import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { serverEnv } from "@/lib/config";
import type { PlanQuote } from "./types";

/**
 * Read a HealthCare.gov plan screenshot and fill the plan fields.
 *
 * This is the broker's actual workflow: she already screenshots each plan card
 * to send on WhatsApp. Instead of asking her to retype what the picture already
 * says, Claude reads the print and she reviews the result — the print stays
 * attached as the visual backing (docs/cotacao.md §6), and every field remains
 * editable before it reaches the proposal.
 *
 * The schema below mirrors the real Spanish plan card:
 *   Prima $X/mes · "Incluye el $Y del crédito fiscal" · "estaba $Z"
 *   Deducible / Gastos máximos de su bolsillo  (both "Total de la familia")
 *   Usted paga: primaria · especialista · urgencias · emergencias · mental · genérico
 */

const MONEY = "Somente o número, sem cifrão nem separador de milhar (ex.: 3087.47). null se não aparecer.";

const PlanExtraction = z.object({
  seguradora: z.string().describe("Nome da seguradora no topo do card (ex.: 'Oscar Health Maintenance Organization of Florida')."),
  nomePlano: z.string().describe("Nome do plano, o texto em destaque/link (ex.: 'Gold Classic Standard')."),
  planId: z.string().nullable().describe("Valor de 'Identificación del plan' (ex.: '21525FL0020015')."),
  metalLevel: z
    .enum(["Bronze", "Silver", "Gold", "Platinum", "Catastrophic"])
    .describe("Traduza o nível do espanhol: Bronce=Bronze, Plata=Silver, Oro=Gold, Platino=Platinum."),
  tipoPlano: z.string().nullable().describe("Desenho do plano tal como aparece: HMO, PPO, EPO ou POS."),
  premioMensal: z.number().describe(`Valor de 'Prima' — o que o cliente paga por mês, JÁ com o crédito. ${MONEY}`),
  premioSemCredito: z
    .number()
    .nullable()
    .describe(`Valor riscado após 'estaba' — o prêmio antes do crédito. ${MONEY}`),
  creditoFiscal: z
    .number()
    .nullable()
    .describe(`Valor citado em 'Incluye el $X del crédito fiscal'. ${MONEY}`),
  dedutivel: z.number().nullable().describe(`'Deducible' (total da família quando indicado). ${MONEY}`),
  maxBolso: z.number().nullable().describe(`'Gastos máximos de su bolsillo' (total da família). ${MONEY}`),
  custoAnualEstimado: z
    .number()
    .nullable()
    .describe(`'Costo total anual estimado', se houver um valor. Se só existir o link 'Agregar costo anual', use null. ${MONEY}`),
  atencaoPrimaria: z.string().nullable().describe("Linha 'Atención primaria' da tabela 'Usted paga', texto integral."),
  atencaoEspecialista: z.string().nullable().describe("Linha 'Atención de especialista'."),
  atencaoUrgencia: z.string().nullable().describe("Linha 'Atención de urgencias'."),
  emergencia: z.string().nullable().describe("Linha 'Sala de emergencias'."),
  saudeMental: z.string().nullable().describe("Linha 'Cuidado de salud mental ambulatoria'."),
  medicamentoGenerico: z.string().nullable().describe("Linha 'Medicamento genérico'."),
});

export type PlanExtraction = z.infer<typeof PlanExtraction>;

/**
 * JSON Schema for `output_config.format`. Written by hand rather than derived:
 * the SDK's zod helper targets Zod v4 and this project is on v3. Structured
 * outputs require `additionalProperties: false` and every key in `required`
 * (nullable fields express "not present", not "omitted").
 */
const money = (description: string) => ({ type: ["number", "null"], description });
const text = (description: string) => ({ type: ["string", "null"], description });

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "seguradora", "nomePlano", "planId", "metalLevel", "tipoPlano",
    "premioMensal", "premioSemCredito", "creditoFiscal", "dedutivel", "maxBolso",
    "custoAnualEstimado", "atencaoPrimaria", "atencaoEspecialista",
    "atencaoUrgencia", "emergencia", "saudeMental", "medicamentoGenerico",
  ],
  properties: {
    seguradora: { type: "string", description: "Seguradora no topo do card (ex.: 'Oscar Health Maintenance Organization of Florida')." },
    nomePlano: { type: "string", description: "Nome do plano em destaque (ex.: 'Gold Classic Standard')." },
    planId: text("Valor de 'Identificación del plan' (ex.: '21525FL0020015')."),
    metalLevel: {
      type: "string",
      enum: ["Bronze", "Silver", "Gold", "Platinum", "Catastrophic"],
      description: "Traduza do espanhol: Bronce=Bronze, Plata=Silver, Oro=Gold, Platino=Platinum.",
    },
    tipoPlano: text("Desenho do plano: HMO, PPO, EPO ou POS."),
    premioMensal: { type: "number", description: `'Prima' — mensalidade JÁ com o crédito. ${MONEY}` },
    premioSemCredito: money(`Valor após 'estaba' — prêmio antes do crédito. ${MONEY}`),
    creditoFiscal: money(`Valor em 'Incluye el $X del crédito fiscal'. ${MONEY}`),
    dedutivel: money(`'Deducible' (total da família quando indicado). ${MONEY}`),
    maxBolso: money(`'Gastos máximos de su bolsillo'. ${MONEY}`),
    custoAnualEstimado: money(`'Costo total anual estimado'. Se houver só o link 'Agregar costo anual', null. ${MONEY}`),
    atencaoPrimaria: text("Linha 'Atención primaria' de 'Usted paga', texto integral."),
    atencaoEspecialista: text("Linha 'Atención de especialista'."),
    atencaoUrgencia: text("Linha 'Atención de urgencias'."),
    emergencia: text("Linha 'Sala de emergencias'."),
    saudeMental: text("Linha 'Cuidado de salud mental ambulatoria'."),
    medicamentoGenerico: text("Linha 'Medicamento genérico'."),
  },
} as const;

const SYSTEM = `Você extrai dados de prints de planos de saúde do Marketplace (HealthCare.gov). Os prints normalmente estão em espanhol.

Regras:
- Transcreva EXATAMENTE o que está escrito. Nunca calcule, estime ou complete um valor que não esteja visível.
- Se um campo não aparecer no print, devolva null. Não invente.
- Nos textos de cobertura ("Usted paga"), mantenha a frase completa como está no print (ex.: "$30 por visita desde el día 1", "25% coaseguro después del deducible", "Sin cargo").
- 'Prima' é o valor mensal já com o crédito fiscal; o valor riscado após "estaba" é o prêmio sem o crédito.`;

export class ExtractionConfigError extends Error {
  code = "extract_config" as const;
}

/** Vision extraction of a plan card. Throws with a clear message when unusable. */
export async function extractPlanFromPrint(
  bytes: Uint8Array,
  mediaType: string,
): Promise<Partial<PlanQuote> & { seguradora: string; nomePlano: string }> {
  if (!serverEnv.anthropicApiKey) {
    throw new ExtractionConfigError(
      "ANTHROPIC_API_KEY não configurada — necessária para ler os prints automaticamente.",
    );
  }

  const supported = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  const type = supported.includes(mediaType) ? mediaType : "image/png";

  const client = new Anthropic({ apiKey: serverEnv.anthropicApiKey });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: type as "image/png", data: Buffer.from(bytes).toString("base64") },
          },
          { type: "text", text: "Extraia os dados deste plano." },
        ],
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);

  // Check the stop reason before reading content — a refusal carries no answer.
  if (response.stop_reason === "refusal") {
    throw new Error("Não foi possível ler este print. Preencha os campos manualmente.");
  }

  const raw = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!raw) throw new Error("Não consegui identificar um plano neste print. Preencha os campos manualmente.");

  const result = PlanExtraction.safeParse(JSON.parse(raw));
  if (!result.success) {
    throw new Error("O print não parece ser um plano do Marketplace. Preencha os campos manualmente.");
  }
  const parsed = result.data;

  // The card shows the gross premium and the credit; the headline "Prima" is
  // already net. Derive the credit only when the print didn't state it.
  const gross = parsed.premioSemCredito ?? parsed.premioMensal;
  const credit = parsed.creditoFiscal ?? Math.max(0, gross - parsed.premioMensal);

  return {
    planId: parsed.planId ?? "",
    seguradora: parsed.seguradora,
    nomePlano: parsed.nomePlano,
    metalLevel: parsed.metalLevel,
    premioMensal: parsed.premioMensal,
    premioSemCredito: gross,
    creditoFiscal: credit,
    dedutivel: parsed.dedutivel,
    maxBolso: parsed.maxBolso,
    atencaoPrimaria: parsed.atencaoPrimaria,
    atencaoEspecialista: parsed.atencaoEspecialista,
    atencaoUrgencia: parsed.atencaoUrgencia,
    emergencia: parsed.emergencia,
    saudeMental: parsed.saudeMental,
    medicamentoGenerico: parsed.medicamentoGenerico,
    tipoPlano: parsed.tipoPlano,
    custoAnualEstimado: parsed.custoAnualEstimado,
    qualityRating: null,
    hsaElegivel: null,
    // Read from a print, then reviewed by the broker — never an API quote.
    fonte: "manual",
  };
}
