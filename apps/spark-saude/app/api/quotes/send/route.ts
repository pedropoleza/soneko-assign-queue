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

const channelSchema = z.enum(["WhatsApp", "SMS", "Email"]);

const bodySchema = z.object({
  contactId: z.string().min(1),
  message: z.string().min(1),
  /**
   * Channels the broker picked — she can send on one or on both at once, and
   * each is reported back separately so a failure on one doesn't hide the other.
   */
  channels: z.array(channelSchema).min(1).optional(),
  /** Legacy single-channel field, still accepted. */
  channel: channelSchema.optional(),
  /** Language of the client-facing material (message, e-mail and PDF). */
  idioma: z.enum(["pt", "es", "en"]).optional(),
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

export interface ChannelResult {
  channel: "WhatsApp" | "Email";
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * POST /api/quotes/send — deliver the proposal to the lead through GHL
 * Conversations, so the message lands on the channel the contact already uses
 * and the thread stays in the CRM instead of a personal WhatsApp.
 *
 * Channel model: the pilot's WhatsApp is an UNOFFICIAL integration that rides
 * the SMS channel (free text, no 24h-template rule), so "WhatsApp" maps to the
 * configured transport (default SMS). E-mail is sent as branded HTML. Before
 * sending we check the contact actually has the field each channel needs and
 * return a clear, actionable error if not — the UI offers to fill it inline.
 *
 * Both channels can be requested at once. The PDF is rendered ONCE and the same
 * signed URL is attached to every channel.
 */
export async function POST(req: Request) {
  try {
    const location = locationFromRequest(req);
    const body = bodySchema.parse(await req.json());
    const { contactId, message, idioma, proposalUrl, profile, quoteId, attachPdf } = body;

    // "SMS" from the legacy field is the same delivery as WhatsApp here.
    const picked = body.channels?.length ? body.channels : [body.channel ?? "WhatsApp"];
    const wants = {
      whatsapp: picked.some((c) => c === "WhatsApp" || c === "SMS"),
      email: picked.includes("Email"),
    };

    // Guard on the destination fields so GHL's cryptic error never reaches the
    // broker: she gets "falta o telefone/e-mail" and fills it on the spot.
    if (!serverEnv.useFixtures) {
      const contact = await getContactChannelsData(location, contactId);
      if (wants.email && !contact.email) {
        return jsonError(new Error("O contato não tem e-mail. Preencha para enviar por e-mail."));
      }
      if (wants.whatsapp && !contact.phone) {
        return jsonError(new Error("O contato não tem telefone. Preencha para enviar por WhatsApp."));
      }
    }

    // A proposta em PDF é o que a cliente realmente recebe — geramos aqui, no
    // servidor, uma única vez, e anexamos nos dois canais. Best-effort: se o PDF
    // falhar, a mensagem com o link ainda sai (melhor do que não enviar nada).
    let attachments: string[] | undefined;
    let pdfError: string | undefined;
    if (attachPdf && quoteId) {
      try {
        attachments = [await renderProposalPdfUrl(quoteId, idioma)];
      } catch (e) {
        pdfError = (e as Error).message;
      }
    }

    const results: ChannelResult[] = [];

    if (wants.whatsapp) {
      try {
        const res = await sendMessageData(
          location, contactId, message, serverEnv.whatsappTransport, undefined, attachments,
        );
        results.push({ channel: "WhatsApp", ok: true, messageId: res.messageId });
      } catch (e) {
        results.push({ channel: "WhatsApp", ok: false, error: (e as Error).message });
      }
    }

    if (wants.email) {
      try {
        const brand = getBrand(location);
        const email = buildClientEmail({
          profile: {
            contactName: profile?.contactName,
            year: profile?.year ?? new Date().getFullYear(),
            idioma,
          } as QuoteProfile,
          message,
          proposalUrl: proposalUrl || "",
          brand,
          disclaimer: brand.disclaimer,
        });
        const res = await sendMessageData(location, contactId, message, "Email", email, attachments);
        results.push({ channel: "Email", ok: true, messageId: res.messageId });
      } catch (e) {
        results.push({ channel: "Email", ok: false, error: (e as Error).message });
      }
    }

    // Nada saiu? Isso é falha do envio inteiro, não um sucesso parcial.
    if (!results.some((r) => r.ok)) {
      return jsonError(new Error(results.map((r) => `${r.channel}: ${r.error}`).join(" · ") || "Nenhum canal selecionado."));
    }

    return jsonOk({ ok: true, results, pdfAttached: Boolean(attachments?.length), pdfError });
  } catch (err) {
    // Um payload inválido não é sempre "falta contato/mensagem" — dizer qual
    // campo caiu é o que evita caçar o erro no escuro.
    if (err instanceof z.ZodError) {
      const where = err.issues.map((i) => i.path.join(".") || "corpo").join(", ");
      return jsonError(new Error(`Dados inválidos no envio (${where}).`));
    }
    return jsonError(err);
  }
}
