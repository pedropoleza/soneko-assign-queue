import { getContactData } from "@/lib/ghl";
import { prefillFromContact } from "@/lib/cotacao/prefill";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/quotes/prefill?contactId=…&year=…
 * Reads the real contact from the CRM and returns a household seed for the
 * builder, so picking a client fills the quote instead of just naming it.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId");
    if (!contactId) return jsonError(new Error("contactId é obrigatório."));

    const year = Number(url.searchParams.get("year")) || new Date().getFullYear() + 1;
    const contact = await getContactData(url.searchParams.get("locationId") ?? undefined, contactId);
    return jsonOk(prefillFromContact(contact, year));
  } catch (err) {
    return jsonError(err);
  }
}
