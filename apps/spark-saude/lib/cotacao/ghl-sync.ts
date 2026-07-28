import { addNoteData, addTagsData, linkContactsData, updateFieldData } from "@/lib/ghl";
import { formatMoneyBR } from "@/lib/utils";
import type { PlanOptionDraft, QuoteProfile } from "./types";

/**
 * GHL write-backs for cotação events (docs/cotacao.md §9). This is the
 * "conectado em nível de informação" bridge: the quotation product writes to
 * the SAME CRM the Spark Saúde dashboard reads, so a sent/approved proposal
 * shows up in the pipeline, tags and renewals views.
 *
 * NOTE: moving the opportunity card to a stage needs the opportunity id for the
 * contact; that lookup is a follow-up once we wire the live pipeline sync.
 */

/**
 * The note left on the contact's timeline. A quote that only lives in our
 * database is invisible to whoever opens the lead in GHL later — this is what
 * ties the two together, in plain language rather than ids.
 */
export function buildQuoteNote(args: {
  profile: QuoteProfile;
  options: PlanOptionDraft[];
  url: string;
  expiresAt: string;
  recommendedPlanId?: string | null;
}): string {
  const { profile, options, url, expiresAt, recommendedPlanId } = args;
  const people = profile.people
    .map((p) => (p.contactName ? `${p.contactName} (${p.relationship}, ${p.age}a)` : `${p.relationship} ${p.age}a`))
    .join(", ");

  const lines = [
    `COTAÇÃO ENVIADA · ${new Date().toLocaleDateString("pt-BR")}`,
    ``,
    `Perfil: ${profile.people.length} pessoa(s) (${people})`,
    `CEP ${profile.zipcode}/${profile.state} · renda ${formatMoneyBR(profile.income)}/ano · plano ${profile.year}`,
    ``,
    `Opções propostas (${options.length}):`,
    ...options.map((o) => {
      const mark = recommendedPlanId && o.planId === recommendedPlanId ? " ← recomendado" : "";
      return `• ${o.nomePlano} (${o.seguradora}, ${o.metalLevel}) — ${formatMoneyBR(o.premioMensal)}/mês, dedutível ${formatMoneyBR(
        o.dedutivel,
      )}${mark}`;
    }),
    ``,
    `Proposta: ${url}`,
    `Válida até ${new Date(expiresAt).toLocaleDateString("pt-BR")}`,
    ``,
    `Valores estimados — confirmados na aplicação oficial.`,
  ];

  return lines.join("\n");
}

/** Proposal sent → tag the contact and record the quote on its timeline. */
export async function onProposalSent(
  location: string | undefined,
  contactId: string | undefined,
  note?: string,
) {
  if (!contactId) return;
  await addTagsData(location, contactId, ["cotacao_enviada"]);
  if (note) {
    // The note is history, not a gate: a CRM hiccup must not fail a quote the
    // broker has already generated and can already send.
    await addNoteData(location, contactId, note).catch(() => undefined);
  }
}

/**
 * Link every household member to the policyholder via the contact association,
 * so the family reads as a family inside the CRM. Best-effort per member: one
 * failed link (missing scope, member deleted) must not undo the others nor the
 * quote itself.
 */
export async function linkHouseholdMembers(
  location: string | undefined,
  primaryContactId: string | undefined,
  people: QuoteProfile["people"],
): Promise<void> {
  if (!primaryContactId) return;
  const members = people.map((p) => p.contactId).filter((id): id is string => Boolean(id) && id !== primaryContactId);
  await Promise.allSettled(members.map((id) => linkContactsData(location, primaryContactId, id)));
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
  await addNoteData(
    location,
    contactId,
    `PROPOSTA APROVADA · ${new Date().toLocaleDateString("pt-BR")}\n\nO cliente aprovou: ${planName}`,
  ).catch(() => undefined);
}
