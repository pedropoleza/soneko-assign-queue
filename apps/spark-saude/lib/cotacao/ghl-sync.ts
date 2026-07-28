import { addNoteData, addTagsData, linkContactsData, updateBasicsData, updateFieldData } from "@/lib/ghl";
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

const GHL_GENDER: Record<string, "male" | "female"> = { Male: "male", Female: "female" };

/**
 * Sync every household member back into the CRM: upsert the basics the broker
 * just typed (birth date, gender) onto each linked contact — the titular
 * included, via the "Self" row — and link members to the policyholder through
 * the contact association, so the family reads as a family inside GHL.
 * Best-effort per member: one failed write (missing scope, member deleted)
 * must not undo the others nor the quote itself.
 */
export async function syncHouseholdMembers(
  location: string | undefined,
  primaryContactId: string | undefined,
  people: QuoteProfile["people"],
): Promise<void> {
  if (!primaryContactId) return;
  const jobs: Promise<unknown>[] = [];
  for (const p of people) {
    // A "Self" row without an explicit link IS the policyholder.
    const id: string | undefined = p.contactId ?? (p.relationship === "Self" ? primaryContactId : undefined);
    if (!id) continue;
    const basics = { dateOfBirth: p.dob ?? undefined, gender: GHL_GENDER[p.gender] };
    if (basics.dateOfBirth || basics.gender) jobs.push(updateBasicsData(location, id, basics));
    if (id !== primaryContactId) jobs.push(linkContactsData(location, primaryContactId, id));
  }
  await Promise.allSettled(jobs);
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
