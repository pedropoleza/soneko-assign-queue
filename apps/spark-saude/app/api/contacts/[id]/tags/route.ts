import { z } from "zod";
import { addTagsData, removeTagsData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tags: z.array(z.string().min(1)).min(1).max(25),
});

/** Add tags (e.g. mark renovacao_avisada). Write is confirmed on the front. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { tags } = bodySchema.parse(await req.json());
    return jsonOk({ tags: await addTagsData(locationFromRequest(req), id, tags) });
  } catch (err) {
    return jsonError(err);
  }
}

/** Remove tags. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { tags } = bodySchema.parse(await req.json());
    return jsonOk({ tags: await removeTagsData(locationFromRequest(req), id, tags) });
  } catch (err) {
    return jsonError(err);
  }
}
