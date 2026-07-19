import { getConfigData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return jsonOk(await getConfigData(locationFromRequest(req)));
  } catch (err) {
    return jsonError(err);
  }
}
