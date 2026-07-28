import crypto from "node:crypto";
import { z } from "zod";
import { getProposalByToken, getQuote, recordResponse } from "@/lib/cotacao/quotes";
import { verifyProposalToken } from "@/lib/cotacao/token";
import { onOptionApproved } from "@/lib/cotacao/ghl-sync";
import { resolveLocationId } from "@/lib/config";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  quoteOptionId: z.string(),
  decisao: z.enum(["aprovado", "recusado"]),
  comentario: z.string().max(2000).optional(),
});

const hashIp = (req: Request): string | undefined => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32) : undefined;
};

/** POST /api/proposal/{token}/respond — PUBLIC approve/reject of one option. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { quoteId, expired } = verifyProposalToken(token);
    if (expired) return jsonError(new Error("Este link de proposta expirou."));

    const { quoteOptionId, decisao, comentario } = bodySchema.parse(await req.json());

    // The option must belong to this token's quote (no cross-quote responses).
    const proposal = await getProposalByToken(token);
    const option = proposal?.options.find((o) => o.id === quoteOptionId);
    if (!option) return jsonError(new Error("Opção não encontrada nesta proposta."));

    await recordResponse({ quoteOptionId, decisao, comentario, ipHash: hashIp(req) });

    // Write back to the GHL CRM on approval (tag + chosen plan).
    if (decisao === "aprovado") {
      const quote = await getQuote(quoteId);
      await onOptionApproved(resolveLocationId(quote?.corretoraId), quote?.ghlContactId ?? undefined, option.nomePlano);
    }

    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
