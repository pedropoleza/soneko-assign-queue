import { z } from "zod";
import { resolveLocationId } from "@/lib/config";
import { createQuote, proposalUrl } from "@/lib/cotacao/quotes";
import { buildSearchRequest } from "@/lib/cms/household";
import { buildQuoteNote, linkHouseholdMembers, onProposalSent } from "@/lib/cotacao/ghl-sync";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";
import type { PlanOptionDraft, QuoteProfile } from "@/lib/cotacao/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionSchema = z.object({
  planId: z.string(),
  seguradora: z.string(),
  nomePlano: z.string(),
  metalLevel: z.string(),
  premioMensal: z.number(),
  premioSemCredito: z.number(),
  creditoFiscal: z.number(),
  dedutivel: z.number().nullable(),
  maxBolso: z.number().nullable(),
  atencaoPrimaria: z.string().nullable(),
  atencaoEspecialista: z.string().nullable(),
  atencaoUrgencia: z.string().nullable(),
  emergencia: z.string().nullable(),
  saudeMental: z.string().nullable(),
  medicamentoGenerico: z.string().nullable(),
  // Real CMS plan attributes. These MUST be declared: zod strips unknown keys,
  // so anything missing here is silently dropped before it reaches the database.
  tipoPlano: z.string().nullable().optional(),
  qualityRating: z.number().nullable().optional(),
  hsaElegivel: z.boolean().nullable().optional(),
  custoAnualEstimado: z.number().nullable().optional(),
  fonte: z.enum(["api", "manual"]),
  printUrl: z.string().nullable().optional(),
});

const bodySchema = z.object({
  profile: z.object({
    contactId: z.string().optional(),
    contactName: z.string().optional(),
    zipcode: z.string(),
    state: z.string().default("FL"),
    countyfips: z.string().optional(),
    income: z.number(),
    year: z.number().int(),
    people: z.array(z.any()).min(1),
  }),
  options: z.array(optionSchema).min(1),
  ttlDays: z.number().int().positive().optional(),
  /** Plan the broker chose to highlight — recorded in the CRM note. */
  recommendedPlanId: z.string().nullish(),
});

/** POST /api/quotes — persist a quote from the chosen options and mint the link. */
export async function POST(req: Request) {
  try {
    const location = locationFromRequest(req);
    const parsed = bodySchema.parse(await req.json());
    const profile = parsed.profile as QuoteProfile;

    // Store the exact household we would send to the CMS (audit / regenerate).
    const householdJson = await buildSearchRequest(profile).catch(() => ({ profile }));

    const quote = await createQuote({
      profile,
      options: parsed.options as PlanOptionDraft[],
      corretoraId: resolveLocationId(location),
      householdJson,
      recommendedPlanId: parsed.recommendedPlanId ?? null,
      ttlDays: parsed.ttlDays,
    });

    const url = proposalUrl(quote.proposalToken);

    // Family links are history too: associate each attached member to the
    // policyholder so the household reads as one inside the CRM. Best-effort —
    // never blocks the quote.
    await linkHouseholdMembers(location, profile.contactId, profile.people ?? []).catch(() => undefined);

    // Tag the contact AND record the quote on its timeline, so the lead in GHL
    // shows what was quoted without anyone opening this app.
    await onProposalSent(
      location,
      profile.contactId,
      buildQuoteNote({
        profile,
        options: parsed.options as PlanOptionDraft[],
        url,
        expiresAt: quote.tokenExpiresAt,
        recommendedPlanId: parsed.recommendedPlanId ?? null,
      }),
    );

    return jsonOk({ id: quote.id, token: quote.proposalToken, url, expiresAt: quote.tokenExpiresAt });
  } catch (err) {
    return jsonError(err);
  }
}
