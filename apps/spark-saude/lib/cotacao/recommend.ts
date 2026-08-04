import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { serverEnv } from "@/lib/config";
import { formatMoneyBR } from "@/lib/utils";
import type { PlanOptionDraft, QuoteProfile } from "./types";

/**
 * Suggest which of the proposed plans best fits this household, with a reason
 * the broker can say out loud to the client.
 *
 * This is a *sales aid*, not an underwriting decision: the model compares the
 * options the broker already chose and argues for one of them. It never invents
 * a plan, never quotes a number that isn't in the options, and the broker
 * decides whether to show it — so a bad suggestion costs nothing but a click.
 */

const Recommendation = z.object({
  planId: z.string(),
  titulo: z.string(),
  motivo: z.string(),
  pontos: z.array(z.string()).min(1).max(4),
  alerta: z.string().nullable(),
});

export type Recommendation = z.infer<typeof Recommendation>;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["planId", "titulo", "motivo", "pontos", "alerta"],
  properties: {
    planId: { type: "string", description: "O planId EXATO de uma das opções recebidas." },
    titulo: { type: "string", description: "Frase curta (até 60 caracteres) do porquê, ex.: 'Melhor custo-benefício para a família'." },
    motivo: {
      type: "string",
      description:
        "2 a 3 frases, em português do Brasil, explicando ao CLIENTE por que este plano faz sentido para ele. " +
        "Linguagem simples, sem jargão. Cite apenas números que estão nas opções.",
    },
    pontos: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
      description: "Argumentos curtos (até 70 caracteres cada) para a corretora usar na conversa.",
    },
    alerta: {
      type: ["string", "null"],
      description: "Uma ressalva honesta se houver (ex.: dedutível alto). null se não houver.",
    },
  },
} as const;

const SYSTEM = `Você ajuda uma corretora de seguros de saúde (Marketplace/Obamacare na Flórida) a escolher qual das opções cotadas apresentar como recomendada ao cliente.

Como decidir:
- Considere o custo real total, não só a mensalidade: prêmio + dedutível + máximo do bolso.
- Considere o perfil da família: número de pessoas, idades e uso provável. Famílias com crianças e idosos tendem a usar mais a rede, então copagamentos baixos e dedutível baixo pesam mais que uma mensalidade baixa.
- Planos Silver com CSR costumam ter custo de bolso muito menor para rendas mais baixas.
- Uma mensalidade de $0 não é automaticamente a melhor: um dedutível muito alto pode custar mais no ano.

Regras:
- Recomende SOMENTE uma das opções recebidas, usando o planId exato.
- Nunca invente valores. Use apenas os números fornecidos.
- Fale com o cliente, não com um especialista: sem siglas não explicadas.
- Seja honesto: se a recomendação tem um ponto fraco, coloque em "alerta".`;

export class RecommendConfigError extends Error {
  code = "recommend_config" as const;
}

export async function recommendPlan(profile: QuoteProfile, options: PlanOptionDraft[]): Promise<Recommendation> {
  if (!serverEnv.anthropicApiKey) {
    throw new RecommendConfigError("ANTHROPIC_API_KEY não configurada — necessária para sugerir o melhor plano.");
  }
  if (options.length < 1) throw new Error("Adicione ao menos um plano.");

  const family = profile.people
    .map((p) => `${p.relationship}, ${p.age} anos, ${p.gender === "Male" ? "masculino" : "feminino"}${p.usesTobacco ? ", fumante" : ""}`)
    .join("; ");

  const planos = options
    .map((o) =>
      [
        `planId: ${o.planId}`,
        `nome: ${o.nomePlano} (${o.seguradora})`,
        `nível: ${o.metalLevel}${o.tipoPlano ? ` ${o.tipoPlano}` : ""}`,
        `mensalidade: ${formatMoneyBR(o.premioMensal)} (bruto ${formatMoneyBR(o.premioSemCredito)}, crédito ${formatMoneyBR(o.creditoFiscal)})`,
        `dedutível: ${formatMoneyBR(o.dedutivel)}`,
        `máximo do bolso: ${formatMoneyBR(o.maxBolso)}`,
        `atenção primária: ${o.atencaoPrimaria ?? "—"}`,
        `especialista: ${o.atencaoEspecialista ?? "—"}`,
        `emergência: ${o.emergencia ?? "—"}`,
        `genéricos: ${o.medicamentoGenerico ?? "—"}`,
      ].join("\n  "),
    )
    .join("\n\n");

  const client = new Anthropic({ apiKey: serverEnv.anthropicApiKey });

  const response = await client.messages.create({
    model: serverEnv.anthropicRecommendModel,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Família: ${family}
Renda anual declarada: ${formatMoneyBR(profile.income)}
Local: ${profile.zipcode}/${profile.state} · plano ${profile.year}

Opções cotadas:

${planos}

Qual apresentar como recomendada, e por quê?`,
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") throw new Error("Não foi possível gerar a recomendação.");

  const raw = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!raw) throw new Error("Não foi possível gerar a recomendação.");

  const parsed = Recommendation.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("Não foi possível gerar a recomendação.");

  // Never let the model point at a plan that isn't on the table.
  const known = options.some((o) => o.planId === parsed.data.planId);
  if (!known) {
    return { ...parsed.data, planId: options[0].planId };
  }
  return parsed.data;
}
