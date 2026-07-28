import { z } from "zod";
import { resolveLocationId } from "@/lib/config";
import { createQuote, proposalUrl } from "@/lib/cotacao/quotes";
import { buildSearchRequest } from "@/lib/cms/household";
import { onProposalSent } from "@/lib/cotacao/ghl-sync";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";
import type { PlanQuote, QuoteProfile } from "@/lib/cotacao/types";

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
  fonte: z.enum(["api", "manual"]),
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
      options: parsed.options as PlanQuote[],
      corretoraId: resolveLocationId(location),
      householdJson,
      ttlDays: parsed.ttlDays,
    });

    await onProposalSent(location, profile.contactId);

    return jsonOk({ id: quote.id, token: quote.proposalToken, url: proposalUrl(quote.proposalToken), expiresAt: quote.tokenExpiresAt });
  } catch (err) {
    return jsonError(err);
  }
}
