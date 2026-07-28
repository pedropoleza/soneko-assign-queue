import { getProposalByToken } from "@/lib/cotacao/quotes";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/proposal/{token} — PUBLIC read of a proposal (Ponta B). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const proposal = await getProposalByToken(token);
    if (!proposal) return jsonError(new Error("Proposta não encontrada."));
    return jsonOk(proposal);
  } catch {
    // Never leak internals to the public endpoint.
    return jsonError(new Error("Link de proposta inválido ou expirado."));
  }
}
