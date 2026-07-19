import { getContactData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return jsonOk(await getContactData(locationFromRequest(req), id));
  } catch (err) {
    return jsonError(err);
  }
}
