import { ghlFetch } from "./client";
import { serverEnv } from "@/lib/config";

/**
 * GHL Associations — how a household stays a household inside the CRM.
 *
 * Linking each dependent to the policyholder via an association means whoever
 * opens the contact in GHL sees the family, not loose records. We resolve the
 * association definition dynamically (never a hardcoded id): prefer the key
 * from GHL_ASSOCIATION_KEY, else the first contact↔contact association in the
 * location, else create one ("familiar") so the feature works out of the box.
 */

interface RawAssociation {
  id: string;
  key?: string;
  firstObjectKey?: string;
  secondObjectKey?: string;
  associationType?: string;
}

const cache = new Map<string, { id: string; at: number }>();
const TTL_MS = 10 * 60_000;

async function listAssociations(locationId: string): Promise<RawAssociation[]> {
  const data = await ghlFetch<unknown>("/associations/", {
    locationId,
    query: { locationId, limit: 100, skip: 0 },
  });
  if (Array.isArray(data)) return data as RawAssociation[];
  const obj = data as { associations?: RawAssociation[]; data?: RawAssociation[] };
  return obj.associations ?? obj.data ?? [];
}

async function createFamiliarAssociation(locationId: string): Promise<RawAssociation> {
  const key = serverEnv.ghlAssociationKey;
  const data = await ghlFetch<RawAssociation & { association?: RawAssociation }>("/associations/", {
    locationId,
    method: "POST",
    body: {
      locationId,
      key,
      firstObjectLabel: "Familiar",
      firstObjectKey: "contact",
      secondObjectLabel: "Familiar",
      secondObjectKey: "contact",
    },
  });
  return data.association ?? data;
}

const isContactPair = (a: RawAssociation) =>
  (a.firstObjectKey ?? "contact").includes("contact") && (a.secondObjectKey ?? "contact").includes("contact");

/** Resolve the association definition to use for household links (cached). */
async function resolveAssociationId(locationId: string): Promise<string> {
  const hit = cache.get(locationId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.id;

  const all = await listAssociations(locationId);
  const preferred =
    all.find((a) => a.key === serverEnv.ghlAssociationKey && isContactPair(a)) ??
    all.find((a) => isContactPair(a) && a.associationType !== "SYSTEM_DEFINED") ??
    all.find(isContactPair);

  const def = preferred ?? (await createFamiliarAssociation(locationId));
  if (!def?.id) throw new Error("Não foi possível resolver a associação de contatos no GHL.");
  cache.set(locationId, { id: def.id, at: Date.now() });
  return def.id;
}

/**
 * Link two contacts under the household association. Idempotent in spirit: a
 * relation that already exists comes back as a 4xx from GHL, which we treat as
 * success — the outcome the caller wanted is "these two are linked".
 */
export async function linkContacts(locationId: string, firstRecordId: string, secondRecordId: string): Promise<void> {
  if (!firstRecordId || !secondRecordId || firstRecordId === secondRecordId) return;
  const associationId = await resolveAssociationId(locationId);
  try {
    await ghlFetch("/associations/relations", {
      locationId,
      method: "POST",
      body: { locationId, associationId, firstRecordId, secondRecordId },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status >= 400 && status < 500) return; // já vinculados / relação duplicada
    throw err;
  }
}
