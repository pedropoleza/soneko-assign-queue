import { z } from "zod";
import { getContactData, updateBasicsData } from "@/lib/ghl";
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

const basicsSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(["male", "female"]).optional(),
  phone: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
});

/**
 * PATCH /api/contacts/[id] — upsert native fields onto the contact (birth date,
 * phone, e-mail). Called as the broker fills a linked member's fields or a
 * missing contact detail at dispatch, so the CRM record converges on what was
 * just typed without waiting for the proposal.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const basics = basicsSchema.parse(await req.json());
    return jsonOk(await updateBasicsData(locationFromRequest(req), id, basics));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(new Error(err.issues[0]?.message || "Dados inválidos."));
    return jsonError(err);
  }
}
