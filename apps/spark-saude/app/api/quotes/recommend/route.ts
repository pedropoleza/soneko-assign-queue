import { recommendPlan } from "@/lib/cotacao/recommend";
import { jsonError, jsonOk } from "@/lib/http";
import type { PlanOptionDraft, QuoteProfile } from "@/lib/cotacao/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/quotes/recommend — suggest which quoted plan to present. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { profile?: QuoteProfile; options?: PlanOptionDraft[] };
    if (!body.profile || !body.options?.length) return jsonError(new Error("Perfil e opções são obrigatórios."));
    return jsonOk(await recommendPlan(body.profile, body.options));
  } catch (err) {
    return jsonError(err);
  }
}
