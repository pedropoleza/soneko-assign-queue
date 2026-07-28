import { z } from "zod";
import { sendMessageData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contactId: z.string().min(1),
  message: z.string().min(1),
  channel: z.enum(["SMS", "Email", "WhatsApp"]).default("SMS"),
});

/**
 * POST /api/quotes/send — deliver the proposal to the lead through GHL
 * Conversations, so the message lands on the channel the contact already uses
 * and the thread stays in the CRM instead of a personal WhatsApp.
 */
export async function POST(req: Request) {
  try {
    const location = locationFromRequest(req);
    const { contactId, message, channel } = bodySchema.parse(await req.json());
    return jsonOk(await sendMessageData(location, contactId, message, channel));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(new Error("Contato e mensagem são obrigatórios."));
    return jsonError(err);
  }
}
