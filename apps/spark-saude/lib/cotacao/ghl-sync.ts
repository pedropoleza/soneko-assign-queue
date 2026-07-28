import { addTagsData, updateFieldData } from "@/lib/ghl";

/**
 * GHL write-backs for cotação events (CLAUDE.md §9). This is the "conectado em
 * nível de informação" bridge: the quotation product writes to the SAME CRM the
 * Spark Saúde dashboard reads, so a sent/approved proposal shows up in the
 * pipeline, tags and renewals views. All writes go through the existing GHL
 * facade (server-side, fixture-aware).
 *
 * NOTE: moving the opportunity card to a stage needs the opportunity id for the
 * contact; that lookup is a follow-up once we wire the live pipeline sync.
 */

/** Proposal sent → tag the contact so it surfaces in the Aquisição pipeline. */
export async function onProposalSent(location: string | undefined, contactId?: string) {
  if (!contactId) return;
  await addTagsData(location, contactId, ["cotacao_enviada"]);
}

/** Client approved an option → record the chosen plan + tag on the contact. */
export async function onOptionApproved(
  location: string | undefined,
  contactId: string | undefined,
  planName: string,
) {
  if (!contactId) return;
  await addTagsData(location, contactId, ["opcao_escolhida"]);
  await updateFieldData(location, contactId, "planoEscolhido", planName);
}
