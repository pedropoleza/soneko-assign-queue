import { z } from "zod";
import { moveStageData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
});

/** Move an opportunity to a new stage (e.g. pull into "Renewal pending"). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { pipelineId, stageId } = bodySchema.parse(await req.json());
    return jsonOk(await moveStageData(locationFromRequest(req), id, pipelineId, stageId));
  } catch (err) {
    return jsonError(err);
  }
}
