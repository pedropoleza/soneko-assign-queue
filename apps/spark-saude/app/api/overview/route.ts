import { getOverviewData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const params = {
      from: from && ISO.test(from) ? from : undefined,
      to: to && ISO.test(to) ? to : undefined,
    };
    return jsonOk(await getOverviewData(locationFromRequest(req), params));
  } catch (err) {
    return jsonError(err);
  }
}
