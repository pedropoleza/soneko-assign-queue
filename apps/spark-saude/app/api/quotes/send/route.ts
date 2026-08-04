import { z } from "zod";
import { getContactChannelsData, sendMessageData } from "@/lib/ghl";
import { serverEnv } from "@/lib/config";
import { getBrand } from "@/lib/cotacao/brand";
import { buildClientEmail } from "@/lib/cotacao/email";
import { renderProposalPdfUrl } from "@/lib/cotacao/proposal-pdf";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";
import type { QuoteProfile } from "@/lib/cotacao/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contactId: z.string().min(1),
  message: z.string().min(1),
  /** What the broker picked. "WhatsApp" delivers via the configured transport. */
  channel: z.enum(["WhatsApp", "SMS", "Email"]).default("WhatsApp"),
  /** Passed so the e-mail CTA button is reliable (not scraped from the text). */
  proposalUrl: z.string().url().optional(),
  /** Quote to render as the branded PDF that goes attached to the message. */
  quoteId: z.string().optional(),
  attachPdf: z.boolean().default(true),
  /** Minimal profile echo — only for the e-mail greeting/subject. */
  profile: z
    .object({ contactName: z.string().optional(), year: z.number().int().optional() })
    .optional(),
});

/**
 * POST /api/quotes/send — deliver the proposal to the lead through GHL
 * Conversations, so the message lands on the channel the contact already uses
 * and the thread stays in the CRM instead of a personal WhatsApp.
 *
 * Channel model: the pilot's WhatsApp is an UNOFFICIAL integration that rides
 * the SMS channel (free text, no 24h-template rule), so "WhatsApp" maps to the
 * configured transport (default SMS). E-mail is sent as branded HTML. Before
 * sending we check the contact actually has the field the channel needs and
 * return a clear, actionable error if not — the UI offers to fill it inline.
 */
export async function POST(req: Request) {
  try {
    const location = locationFromRequest(req);
    const { contactId, message, channel, proposalUrl, profile, quoteId, attachPdf } = bodySchema.parse(
      await req.json(),
    );

    const needsEmail = channel === "Email";
    const transport: "SMS" | "Email" | "WhatsApp" = needsEmail ? "Email" : serverEnv.whatsappTransport;

    // Guard on the destination field so GHL's cryptic error never reaches the
    // broker: she gets "falta o telefone/e-mail" and fills it on the spot.
    if (!serverEnv.useFixtures) {
      const contact = await getContactChannelsData(location, contactId);
      if (needsEmail && !contact.email) {
        return jsonError(new Error("O contato não tem e-mail. Preencha para enviar por e-mail."));
      }
      if (!needsEmail && !contact.phone) {
        return jsonError(new Error("O contato não tem telefone. Preencha para enviar por WhatsApp."));
      }
    }

    let email: { subject: string; html: string } | undefined;
    if (needsEmail) {
      const brand = getBrand(location);
      email = buildClientEmail({
        profile: { contactName: profile?.contactName, year: profile?.year ?? new Date().getFullYear() } as QuoteProfile,
        message,
        proposalUrl: proposalUrl || "",
        brand,
        disclaimer: brand.disclaimer,
      });
    }

    // A proposta em PDF é o que a cliente realmente recebe — geramos aqui, no
    // servidor, e mandamos como anexo. Best-effort: se o PDF falhar, a
    // mensagem com o link ainda sai (melhor do que não enviar nada).
    let attachments: string[] | undefined;
    let pdfError: string | undefined;
    if (attachPdf && quoteId) {
      try {
        attachments = [await renderProposalPdfUrl(quoteId)];
      } catch (e) {
        pdfError = (e as Error).message;
      }
    }

    const res = await sendMessageData(location, contactId, message, transport, email, attachments);
    return jsonOk({ ...res, pdfAttached: Boolean(attachments?.length), pdfError });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(new Error("Contato e mensagem são obrigatórios."));
    return jsonError(err);
  }
}
