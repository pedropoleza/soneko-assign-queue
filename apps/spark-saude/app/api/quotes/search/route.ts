import { z } from "zod";
import { getQuoteSearch } from "@/lib/cms";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const personSchema = z.object({
  age: z.number().int().min(0).max(120),
  gender: z.enum(["Male", "Female"]),
  relationship: z.enum(["Self", "Spouse", "Child", "Dependent"]).default("Self"),
  aptcEligible: z.boolean().default(true),
  usesTobacco: z.boolean().default(false),
});

const profileSchema = z.object({
  contactId: z.string().optional(),
  contactName: z.string().optional(),
  zipcode: z.string().min(3),
  state: z.string().length(2).optional().default("FL"),
  countyfips: z.string().optional(),
  income: z.number().nonnegative(),
  year: z.number().int().min(2024).max(2030),
  people: z.array(personSchema).min(1),
});

/** POST /api/quotes/search — CMS estimate (key stays server-side). */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const profile = profileSchema.parse(body);
    return jsonOk(await getQuoteSearch(profile));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(new Error(`Perfil inválido: ${err.issues.map((i) => i.path.join(".")).join(", ")}`));
    }
    return jsonError(err);
  }
}
