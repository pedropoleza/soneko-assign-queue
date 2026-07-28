import { getQuote } from "@/lib/cotacao/quotes";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/quotes/{id} — broker-side read of a full quote. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quote = await getQuote(id);
    if (!quote) return jsonError(new Error("Cotação não encontrada."));
    return jsonOk(quote);
  } catch (err) {
    return jsonError(err);
  }
}
