import { ghlFetch } from "./client";
import type { Pipeline, PipelineRole, PipelineStage } from "@/lib/types";
import type { TenantConfig } from "./tenant";

/**
 * Pipeline/stage definitions (CLAUDE.md §7). Columns are built dynamically from
 * the API — names/order are NOT hardcoded. Tenant config assigns the
 * acquisition/client roles by pipeline id.
 */

const cache = new Map<string, { pipelines: Pipeline[]; at: number }>();
const TTL_MS = 5 * 60_000;

interface RawStage {
  id: string;
  name?: string;
  position?: number;
}
interface RawPipeline {
  id: string;
  name?: string;
  stages?: RawStage[];
}

function roleFor(id: string, tenant: TenantConfig): PipelineRole | null {
  if (tenant.pipelines.acquisitionId === id) return "acquisition";
  if (tenant.pipelines.clientId === id) return "client";
  return null;
}

export async function getPipelines(locationId: string, tenant: TenantConfig): Promise<Pipeline[]> {
  const c = cache.get(locationId);
  let raw: RawPipeline[];
  if (c && Date.now() - c.at < TTL_MS) {
    return c.pipelines.map((p) => ({ ...p, role: roleFor(p.id, tenant) }));
  }
  const data = await ghlFetch<{ pipelines?: RawPipeline[] }>(
    `/opportunities/pipelines`,
    { locationId, query: { locationId } },
  );
  raw = data.pipelines ?? [];

  const pipelines: Pipeline[] = raw.map((p) => {
    const stages: PipelineStage[] = (p.stages ?? []).map((s, i) => ({
      id: s.id,
      name: s.name ?? `Stage ${i + 1}`,
      position: s.position ?? i,
    }));
    stages.sort((a, b) => a.position - b.position);
    return { id: p.id, name: p.name ?? "Pipeline", role: roleFor(p.id, tenant), stages };
  });

  cache.set(locationId, { pipelines, at: Date.now() });
  return pipelines;
}

export function clearPipelineCache(locationId?: string) {
  if (locationId) cache.delete(locationId);
  else cache.clear();
}
