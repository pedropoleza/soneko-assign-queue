import { getPipelines } from "./pipelines";
import { searchOpportunities } from "./opportunities";
import type { TenantConfig } from "./tenant";
import type { Opportunity, PipelineView, StageBucket } from "@/lib/types";

/**
 * Builds the Pipeline tab view (CLAUDE.md §6): both funnels with per-stage
 * counts and a sample of opportunities. Columns come from the live pipeline
 * definition — never hardcoded.
 */

async function fetchOpps(locationId: string, pipelineId: string, maxPages = 3, limit = 100): Promise<Opportunity[]> {
  const all: Opportunity[] = [];
  let startAfter: number | undefined;
  let startAfterId: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await searchOpportunities({ locationId, pipelineId, limit, startAfter, startAfterId });
    all.push(...res.items);
    if (!res.next?.startAfterId) break;
    startAfter = res.next.startAfter;
    startAfterId = res.next.startAfterId;
  }
  return all;
}

export async function getPipelineViews(locationId: string, tenant: TenantConfig): Promise<PipelineView[]> {
  const pipelines = await getPipelines(locationId, tenant);

  return Promise.all(
    pipelines.map(async (pipeline) => {
      const opps = await fetchOpps(locationId, pipeline.id);
      const byStage = new Map<string, Opportunity[]>();
      for (const o of opps) {
        const list = byStage.get(o.stageId) ?? [];
        list.push(o);
        byStage.set(o.stageId, list);
      }
      const buckets: StageBucket[] = pipeline.stages.map((stage) => {
        const list = byStage.get(stage.id) ?? [];
        return { stage, count: list.length, opportunities: list.slice(0, 50) };
      });
      return { pipeline, buckets, total: opps.length };
    }),
  );
}
