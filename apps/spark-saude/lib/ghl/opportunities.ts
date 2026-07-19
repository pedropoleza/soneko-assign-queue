import { ghlFetch } from "./client";
import type { Opportunity } from "@/lib/types";

/**
 * Opportunities (CLAUDE.md §7). Uses GET /opportunities/search (note: this
 * endpoint takes snake_case query params: location_id, pipeline_id, ...).
 */

interface RawOpp {
  id: string;
  name?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  stageId?: string;
  status?: string;
  monetaryValue?: number;
  contactId?: string;
  contact?: { id?: string };
}

interface OppSearchMeta {
  total?: number;
  nextPageUrl?: string | null;
  startAfterId?: string | null;
  startAfter?: number | null;
  currentPage?: number;
}

function normalize(o: RawOpp): Opportunity {
  return {
    id: o.id,
    name: o.name ?? "(sem nome)",
    contactId: o.contact?.id ?? o.contactId,
    pipelineId: o.pipelineId ?? "",
    stageId: o.pipelineStageId ?? o.stageId ?? "",
    status: o.status,
    monetaryValue: o.monetaryValue,
  };
}

export interface OppSearchParams {
  locationId: string;
  pipelineId?: string;
  stageId?: string;
  limit?: number;
  startAfter?: number;
  startAfterId?: string;
}

export async function searchOpportunities(params: OppSearchParams): Promise<{
  items: Opportunity[];
  total: number;
  next: { startAfter?: number; startAfterId?: string } | null;
}> {
  const { locationId, pipelineId, stageId, limit = 100, startAfter, startAfterId } = params;
  const data = await ghlFetch<{ opportunities?: RawOpp[]; meta?: OppSearchMeta }>(
    `/opportunities/search`,
    {
      locationId,
      query: {
        location_id: locationId,
        pipeline_id: pipelineId,
        pipeline_stage_id: stageId,
        limit,
        startAfter,
        startAfterId,
      },
    },
  );
  const items = (data.opportunities ?? []).map(normalize);
  const meta = data.meta ?? {};
  const next =
    meta.nextPageUrl && meta.startAfterId
      ? { startAfter: meta.startAfter ?? undefined, startAfterId: meta.startAfterId ?? undefined }
      : null;
  return { items, total: meta.total ?? items.length, next };
}

/** Cheap count for a pipeline/stage — reads meta.total with limit=1. */
export async function countOpportunities(params: {
  locationId: string;
  pipelineId?: string;
  stageId?: string;
}): Promise<number> {
  const { total } = await searchOpportunities({ ...params, limit: 1 });
  return total;
}

/** Move an opportunity to a new stage (CLAUDE.md §7 write). */
export async function moveOpportunityStage(params: {
  locationId: string;
  opportunityId: string;
  pipelineId: string;
  stageId: string;
}): Promise<Opportunity> {
  const { locationId, opportunityId, pipelineId, stageId } = params;
  const data = await ghlFetch<{ opportunity?: RawOpp }>(`/opportunities/${opportunityId}`, {
    locationId,
    method: "PUT",
    body: { pipelineId, pipelineStageId: stageId },
  });
  return normalize(data.opportunity ?? { id: opportunityId, pipelineId, pipelineStageId: stageId });
}
