import { getRenewalsData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";
import type { RenewalWindow } from "@/lib/ghl/renewals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseWindow(v: string | null): RenewalWindow {
  const n = Number(v);
  return n === 30 || n === 60 ? n : n === 90 ? 90 : 90;
}

export async function GET(req: Request) {
  try {
    const within = parseWindow(new URL(req.url).searchParams.get("within"));
    return jsonOk(await getRenewalsData(locationFromRequest(req), within));
  } catch (err) {
    return jsonError(err);
  }
}
