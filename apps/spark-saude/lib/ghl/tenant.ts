import { DEFAULTS, serverEnv } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SemanticField } from "@/lib/types";

export interface StageRef {
  pipelineId: string;
  stageId: string;
}

export interface TenantConfig {
  locationId: string;
  name?: string;
  linhaTag: string;
  apiVersion: string;
  pipelines: { acquisitionId?: string; clientId?: string };
  stages: { renewalPending?: StageRef; renewalDone?: StageRef };
  renewalTags: { avisado: string; pendente: string; feito: string; naoRenovou: string };
  attentionTags: string[];
  overviewTags: { activeClients: string; applicationsInProgress: string; awaitingApproval: string };
  fieldMap: Partial<Record<SemanticField, string>>;
}

type RawConfig = Partial<Omit<TenantConfig, "locationId" | "name">>;

const CACHE = new Map<string, { value: TenantConfig; at: number }>();
const TTL_MS = 60_000;

function defaults(locationId: string, name?: string): TenantConfig {
  return {
    locationId,
    name,
    linhaTag: DEFAULTS.linhaTag,
    apiVersion: serverEnv.ghlApiVersion,
    pipelines: {},
    stages: {},
    renewalTags: { ...DEFAULTS.renewalTags },
    attentionTags: [...DEFAULTS.attentionTags],
    overviewTags: { ...DEFAULTS.overviewTags },
    fieldMap: {},
  };
}

function merge(base: TenantConfig, raw: RawConfig): TenantConfig {
  return {
    ...base,
    linhaTag: raw.linhaTag ?? base.linhaTag,
    apiVersion: raw.apiVersion ?? base.apiVersion,
    pipelines: { ...base.pipelines, ...raw.pipelines },
    stages: { ...base.stages, ...raw.stages },
    renewalTags: { ...base.renewalTags, ...raw.renewalTags },
    attentionTags: raw.attentionTags?.length ? raw.attentionTags : base.attentionTags,
    overviewTags: { ...base.overviewTags, ...raw.overviewTags },
    fieldMap: { ...base.fieldMap, ...raw.fieldMap },
  };
}

/**
 * Resolve the tenant configuration for a location. Reads from Supabase
 * (spark_saude.tenants via RPC) and falls back to code defaults so the app
 * still works before a tenant row exists. Cached briefly per location.
 */
export async function getTenantConfig(locationId: string): Promise<TenantConfig> {
  const cached = CACHE.get(locationId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  let value = defaults(locationId);
  const db = supabaseAdmin();
  if (db) {
    try {
      const { data, error } = await db.rpc("spark_saude_get_tenant", { p_location_id: locationId });
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          value = merge(defaults(locationId, row.name ?? undefined), (row.config ?? {}) as RawConfig);
        }
      }
    } catch {
      // fall through to defaults — never block the dashboard on config storage.
    }
  }

  CACHE.set(locationId, { value, at: Date.now() });
  return value;
}

export function clearTenantCache(locationId?: string) {
  if (locationId) CACHE.delete(locationId);
  else CACHE.clear();
}
