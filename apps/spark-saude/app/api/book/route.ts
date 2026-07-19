import { getBookData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return jsonOk({ contacts: await getBookData(locationFromRequest(req)) });
  } catch (err) {
    return jsonError(err);
  }
}
