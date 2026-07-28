import { z } from "zod";
import { createContactData, getContactsData } from "@/lib/ghl";
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
    // all=1 lifts the linha_saude filter — used to find household members.
    const all = url.searchParams.get("all") === "1";
    const data = await getContactsData(locationFromRequest(req), { q, cursor, limit, all });
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}

const createSchema = z.object({
  firstName: z.string().trim().min(1, "Nome é obrigatório."),
  lastName: z.string().trim().optional(),
  // Optional on purpose: dependents often have neither.
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(["male", "female"]).optional(),
});

/** POST /api/contacts — create a household member in the CRM. */
export async function POST(req: Request) {
  try {
    const input = createSchema.parse(await req.json());
    return jsonOk(await createContactData(locationFromRequest(req), input));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(new Error(err.issues[0]?.message || "Dados inválidos."));
    return jsonError(err);
  }
}
