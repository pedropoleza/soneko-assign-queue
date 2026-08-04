import { isIdioma, type Idioma } from "./i18n";
import { buildProposalPdf } from "./pdf";
import { getQuote, proposalUrl } from "./quotes";
import { uploadProposalPdf } from "./storage";
import type { PlanOptionDraft, QuoteProfile } from "./types";

/**
 * Rebuild a stored quote into the client-facing PDF.
 *
 * Both the download route and the WhatsApp send path go through here, so the
 * file the broker previews is byte-for-byte the one the client receives.
 *
 * `idioma` overrides the language stored with the quote — the broker can change
 * the dropdown and regenerate without rewriting the saved quote.
 */
export async function renderProposalPdf(
  id: string,
  idioma?: Idioma | null,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const quote = await getQuote(id);
  if (!quote) throw new Error("Cotação não encontrada.");

  // The household (names, ages, relationships) lives in the audit JSON — the
  // quote columns only carry what the CMS needs.
  const stored = (quote.householdJson ?? {}) as { profile?: Partial<QuoteProfile> };
  const profile: QuoteProfile = {
    contactId: quote.ghlContactId ?? undefined,
    contactName: stored.profile?.contactName,
    idioma: isIdioma(idioma) ? idioma : stored.profile?.idioma,
    zipcode: quote.zipcode,
    state: quote.state,
    countyfips: quote.countyfips ?? undefined,
    income: quote.income,
    year: quote.year,
    people: stored.profile?.people ?? [],
  };

  return buildProposalPdf({
    profile,
    options: quote.options as unknown as PlanOptionDraft[],
    recommendedPlanId: quote.recommendedPlanId ?? null,
    url: proposalUrl(quote.proposalToken),
    expiresAt: quote.tokenExpiresAt,
  });
}

/** Render + store, returning the signed URL GHL fetches to attach the file. */
export async function renderProposalPdfUrl(id: string, idioma?: Idioma | null): Promise<string> {
  const { bytes, filename } = await renderProposalPdf(id, idioma);
  const { url } = await uploadProposalPdf(bytes, filename);
  return url;
}
