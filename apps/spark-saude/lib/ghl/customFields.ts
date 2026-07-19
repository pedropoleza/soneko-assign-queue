import { ghlFetch } from "./client";
import type { CustomFieldDef, ContactFields, SemanticField } from "@/lib/types";
import type { TenantConfig } from "./tenant";

/**
 * Resolves GHL custom fields dynamically by fieldKey/name (CLAUDE.md §4, §8).
 * GHL mangles accented keys (e.g. "Data Renovação" -> "contact.data_renovao"),
 * so we NEVER hardcode field IDs. The tenant `fieldMap` gives exact overrides;
 * a normalized fallback covers new tenants without a map.
 */

const cache = new Map<string, { defs: CustomFieldDef[]; at: number }>();
const TTL_MS = 5 * 60_000;

interface RawCustomField {
  id: string;
  fieldKey?: string;
  name?: string;
  dataType?: string;
  model?: string;
}

function normalizeDef(raw: RawCustomField): CustomFieldDef {
  return {
    id: raw.id,
    fieldKey: raw.fieldKey ?? "",
    name: raw.name ?? "",
    dataType: raw.dataType ?? "TEXT",
    model: raw.model,
  };
}

export async function getCustomFieldDefs(locationId: string): Promise<CustomFieldDef[]> {
  const c = cache.get(locationId);
  if (c && Date.now() - c.at < TTL_MS) return c.defs;
  const data = await ghlFetch<{ customFields?: RawCustomField[] }>(
    `/locations/${locationId}/customFields`,
    { locationId },
  );
  const defs = (data.customFields ?? []).map(normalizeDef);
  cache.set(locationId, { defs, at: Date.now() });
  return defs;
}

export function clearFieldCache(locationId?: string) {
  if (locationId) cache.delete(locationId);
  else cache.clear();
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^contact\.|^opportunity\./, "")
    .replace(/[^a-z0-9]/g, "");
}

// Fallback aliases (normalized) for tenants without an explicit fieldMap.
const ALIASES: Partial<Record<SemanticField, string[]>> = {
  dataRenovacao: ["datarenovacao", "datarenovao", "renewaldate"],
  validoAPartir: ["validoapartirde", "validoapartir", "validfrom"],
  policyStartDate: ["policystartdate"],
  nextPolicyAnniversary: ["nextpolicyanniversary"],
  nextFollowup: ["nextfollowup"],
  seguradora: ["seguradora", "carrier"],
  planoEscolhido: ["planoescolhido", "chosenplan"],
  formaPagamento: ["formadepagamento", "formapagamento", "paymentmethod"],
  monthlyPremium: ["monthlypremium", "valormensal"],
  documentacaoRecebida: ["documentaorecebida", "documentacaorecebida"],
  underwritingStatus: ["underwritingstatus"],
  pessoasNaCasa: ["pessoasnacasa"],
  pessoasNoSeguro: ["pessoasnoseguro"],
  rendaCasa: ["rendacasa"],
  idioma: ["idioma", "idiomapref", "language"],
  beneficiario: ["beneficirio", "beneficiario"],
  primaryBeneficiary: ["primarybeneficiary"],
  intencaoRenovar: ["intenorenovar", "intencaorenovar"],
  motivoNaoRenovar: ["motivonorenovar", "motivonaorenovar"],
  mudouRenda: ["mudourenda"],
  mudouEndereco: ["mudouendereo", "mudouendereco"],
  mudouDependentes: ["mudoudependentes"],
  mainObjection: ["mainobjection"],
  submittedProposal: ["submittedproposal"],
};

export interface FieldResolver {
  defs: CustomFieldDef[];
  byId: Map<string, CustomFieldDef>;
  bySemantic: Map<SemanticField, CustomFieldDef>;
  resolve(semantic: SemanticField): CustomFieldDef | undefined;
}

export async function buildFieldResolver(locationId: string, tenant: TenantConfig): Promise<FieldResolver> {
  const defs = await getCustomFieldDefs(locationId);
  const byId = new Map(defs.map((d) => [d.id, d]));
  const byNormKey = new Map(defs.map((d) => [norm(d.fieldKey || d.name), d] as const));
  const bySemantic = new Map<SemanticField, CustomFieldDef>();

  const semantics = new Set<SemanticField>([
    ...(Object.keys(tenant.fieldMap) as SemanticField[]),
    ...(Object.keys(ALIASES) as SemanticField[]),
  ]);

  for (const semantic of semantics) {
    // 1) explicit tenant override (exact fieldKey, then normalized)
    const mapped = tenant.fieldMap[semantic];
    let def: CustomFieldDef | undefined;
    if (mapped) def = defs.find((d) => d.fieldKey === mapped) ?? byNormKey.get(norm(mapped));
    // 2) alias fallback by normalized key
    if (!def) {
      for (const alias of ALIASES[semantic] ?? []) {
        def = byNormKey.get(alias);
        if (def) break;
      }
    }
    if (def) bySemantic.set(semantic, def);
  }

  return {
    defs,
    byId,
    bySemantic,
    resolve: (semantic) => bySemantic.get(semantic),
  };
}

interface RawContactCustomField {
  id: string;
  value?: unknown;
  field_value?: unknown;
}

function coerce(dataType: string, value: unknown): string | number {
  const t = dataType.toUpperCase();
  if (t === "NUMERICAL" || t === "MONETORY" || t === "MONETARY") {
    const n = Number(value);
    return Number.isFinite(n) ? n : String(value);
  }
  return typeof value === "string" ? value : String(value);
}

/** Extract semantic fields from a raw GHL contact using the resolver. */
export function extractContactFields(
  rawCustomFields: RawContactCustomField[] | undefined,
  resolver: FieldResolver,
): ContactFields {
  const out: ContactFields = {};
  const byId = new Map<string, unknown>();
  for (const cf of rawCustomFields ?? []) {
    byId.set(cf.id, cf.value ?? cf.field_value);
  }
  for (const [semantic, def] of resolver.bySemantic) {
    const v = byId.get(def.id);
    if (v !== undefined && v !== null && v !== "") {
      out[semantic] = coerce(def.dataType, v);
    }
  }
  return out;
}
