import { getContactsData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCursor(raw: string | null): (string | number)[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
    const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 100);
    const cursor = parseCursor(url.searchParams.get("cursor"));
    const data = await getContactsData(locationFromRequest(req), { q, cursor, limit });
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}
