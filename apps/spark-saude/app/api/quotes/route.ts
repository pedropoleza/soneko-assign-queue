import { z } from "zod";
import { resolveLocationId } from "@/lib/config";
import { createQuote, listQuotesByContact, proposalUrl } from "@/lib/cotacao/quotes";
import { buildSearchRequest } from "@/lib/cms/household";
import { buildQuoteNote, onProposalSent, syncHouseholdMembers } from "@/lib/cotacao/ghl-sync";
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
    /** Idioma do material do cliente — precisa sobreviver ao zod (ele descarta
     *  chaves desconhecidas) para o PDF ser regerado no idioma certo depois. */
    idioma: z.enum(["pt", "es", "en"]).optional(),
    zipcode: z.string(),
    state: z.string().default("FL"),
    countyfips: z.string().optional(),
    income: z.number(),
    year: z.number().int(),
    people: z.array(z.any()).min(1),
  }),
  options: z.array(optionSchema).min(1),
  ttlDays: z.number().int().positive().optional(),
  /** Rótulo desta proposta — a corretora manda várias para o mesmo cliente. */
  titulo: z.string().max(80).optional(),
  /** Plan the broker chose to highlight — recorded in the CRM note. */
  recommendedPlanId: z.string().nullish(),
});

/** POST /api/quotes — persist a quote from the chosen options and mint the link. */
export async function POST(req: Request) {
  try {
    const location = locationFromRequest(req);
    const parsed = bodySchema.parse(await req.json());
    const profile = parsed.profile as QuoteProfile;

    // Store the exact household we would send to the CMS (audit / regenerate),
    // ALWAYS alongside the raw profile — the CMS shape drops names, relationships
    // and the contact, which the PDF and the notes need to read back.
    const cms = await buildSearchRequest(profile).catch(() => ({}));
    const householdJson = { ...cms, profile };

    const quote = await createQuote({
      profile,
      options: parsed.options as PlanOptionDraft[],
      corretoraId: resolveLocationId(location),
      householdJson,
      recommendedPlanId: parsed.recommendedPlanId ?? null,
      ttlDays: parsed.ttlDays,
      titulo: parsed.titulo ?? null,
    });

    const url = proposalUrl(quote.proposalToken);

    // The CRM converges on what the broker just typed: upsert each member's
    // basics (birth date, gender) and associate them to the policyholder so the
    // household reads as one inside GHL. Best-effort — never blocks the quote.
    await syncHouseholdMembers(location, profile.contactId, profile.people ?? []).catch(() => undefined);

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

    return jsonOk({
      id: quote.id,
      token: quote.proposalToken,
      url,
      expiresAt: quote.tokenExpiresAt,
      titulo: quote.titulo,
    });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * GET /api/quotes?contactId=... — as propostas já feitas para esse cliente.
 *
 * A corretora manda mais de uma proposta para a mesma pessoa (cenários
 * diferentes da mesma família). Sem esta lista, cada proposta nova apagava a
 * anterior da tela e o link do que já foi enviado se perdia.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId");
    if (!contactId) return jsonError(new Error("Informe o contactId."));
    const limit = Number(url.searchParams.get("limit") || 20);
    const items = await listQuotesByContact({
      contactId,
      corretoraId: resolveLocationId(locationFromRequest(req)),
      limit: Number.isFinite(limit) ? limit : 20,
    });
    return jsonOk({ items });
  } catch (err) {
    return jsonError(err);
  }
}
