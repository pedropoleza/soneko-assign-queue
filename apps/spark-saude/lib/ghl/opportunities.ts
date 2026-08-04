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
  /** A busca já traz o contato embutido — inclusive telefone e e-mail. */
  contact?: { id?: string; name?: string; phone?: string | null; email?: string | null };
  /**
   * O mesmo campo volta com nome diferente conforme o endpoint: o GET de uma
   * oportunidade devolve `fieldValue`, a BUSCA devolve `fieldValueString`
   * (ou `fieldValueArray`/`fieldValueDate`, conforme o tipo), e a escrita
   * espera `field_value`. Guardamos o registro cru e lemos por prefixo.
   */
  customFields?: Array<Record<string, unknown> & { id: string }>;
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

/**
 * Percorre TODAS as oportunidades da location, página a página.
 *
 * Devolve o cru: o espelho do telefone precisa do contato embutido e dos custom
 * fields já preenchidos, que o `normalize` descarta.
 */
export async function* iterateOpportunitiesRaw(
  locationId: string,
  pageSize = 100,
): AsyncGenerator<RawOpp> {
  let cursor: { startAfter?: number; startAfterId?: string } | undefined;
  // Trava de segurança: um cursor que não anda não pode virar laço infinito.
  for (let page = 0; page < 200; page++) {
    const data = await ghlFetch<{ opportunities?: RawOpp[]; meta?: OppSearchMeta }>(`/opportunities/search`, {
      locationId,
      query: {
        location_id: locationId,
        limit: pageSize,
        startAfter: cursor?.startAfter,
        startAfterId: cursor?.startAfterId,
      },
    });
    const items = data.opportunities ?? [];
    for (const o of items) yield o;

    const meta = data.meta ?? {};
    if (!meta.nextPageUrl || !meta.startAfterId || items.length === 0) return;
    if (meta.startAfterId === cursor?.startAfterId) return;
    cursor = { startAfter: meta.startAfter ?? undefined, startAfterId: meta.startAfterId ?? undefined };
  }
}

/**
 * Lê o valor de um custom field já gravado na oportunidade.
 *
 * A chave do valor muda com o endpoint e com o tipo do campo (`fieldValue`,
 * `fieldValueString`, `field_value`, …), então procuramos por prefixo em vez de
 * fixar um nome — ler a chave errada devolvia "" e fazia a sincronização
 * reescrever o mesmo número em toda passada.
 */
export function readOppFieldValue(opp: RawOpp, fieldId: string): string {
  const cf = (opp.customFields ?? []).find((f) => f.id === fieldId);
  if (!cf) return "";
  for (const [key, value] of Object.entries(cf)) {
    if (key === "id" || key === "type") continue;
    if (!/^field_?[Vv]alue/.test(key)) continue;
    if (value == null || value === "") continue;
    return Array.isArray(value) ? value.join(", ") : String(value);
  }
  return "";
}

/**
 * Grava um custom field da oportunidade.
 *
 * O PUT aceita `customFields` com `field_value` (snake_case) — a leitura devolve
 * `fieldValue`. Enviamos só o campo alvo: o GHL faz merge, então os outros
 * campos da oportunidade ficam intactos.
 */
export async function setOpportunityField(params: {
  locationId: string;
  opportunityId: string;
  fieldId: string;
  value: string;
}): Promise<void> {
  const { locationId, opportunityId, fieldId, value } = params;
  await ghlFetch(`/opportunities/${opportunityId}`, {
    locationId,
    method: "PUT",
    body: { customFields: [{ id: fieldId, field_value: value }] },
  });
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
