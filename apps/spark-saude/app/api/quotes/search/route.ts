import { z } from "zod";
import { getQuoteSearch } from "@/lib/cms";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const personSchema = z.object({
  // Passthrough of the CRM link — zod strips unknown keys, and the search
  // response's profile is merged back into client state, so dropping these
  // here would silently unlink every household member after a search.
  contactId: z.string().nullish(),
  contactName: z.string().nullish(),
  age: z.number().int().min(0).max(120),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  gender: z.enum(["Male", "Female"]),
  relationship: z.enum(["Self", "Spouse", "Child", "Dependent"]).default("Self"),
  aptcEligible: z.boolean().default(true),
  usesTobacco: z.boolean().default(false),
  hasMec: z.boolean().optional(),
  isPregnant: z.boolean().optional(),
  utilizationLevel: z.enum(["Low", "Medium", "High"]).optional(),
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

const bodySchema = z.object({
  profile: profileSchema.optional(),
  sort: z.enum(["premium", "deductible", "oopc", "total_costs", "quality_rating"]).optional(),
  metalLevels: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/** POST /api/quotes/search — CMS estimate (key stays server-side). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Accept both the bare profile (legacy) and { profile, sort, ... }.
    const wrapped = bodySchema.safeParse(body);
    const profile = wrapped.success && wrapped.data.profile ? wrapped.data.profile : profileSchema.parse(body);
    const opts = wrapped.success
      ? { sort: wrapped.data.sort, metalLevels: wrapped.data.metalLevels, limit: wrapped.data.limit, offset: wrapped.data.offset }
      : {};
    return jsonOk(await getQuoteSearch(profile, opts));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(new Error(`Perfil inválido: ${err.issues.map((i) => i.path.join(".")).join(", ")}`));
    }
    return jsonError(err);
  }
}
