import { serverEnv } from "@/lib/config";
import { findOpportunityField } from "./customFields";
import { iterateOpportunitiesRaw, readOppFieldValue, setOpportunityField } from "./opportunities";

/**
 * Espelha o telefone do contato no custom field da OPPORTUNITY.
 *
 * O GHL não faz isso: a oportunidade guarda o `contactId`, mas o telefone mora
 * só no contato, e não existe workflow nativo que copie um campo do contato
 * para um campo da oportunidade. Sem esse espelho, qualquer coisa que trabalhe
 * no nível da oportunidade — filtro, exportação, coluna de board, automação de
 * SMS por oportunidade — fica sem telefone.
 *
 * A sincronização é IDEMPOTENTE e SÓ ESCREVE quando o valor muda: rodar de novo
 * não gasta chamada nem gera ruído no histórico da oportunidade. O contato é a
 * fonte da verdade — quem edita o campo na oportunidade tem o valor sobrescrito
 * na próxima passada, e isso é intencional.
 */

export interface PhoneSyncResult {
  /** Campo resolvido na conta (chave e id) — útil para conferir a configuração. */
  field: { id: string; fieldKey: string; name: string } | null;
  scanned: number;
  updated: number;
  /** Já estava com o valor certo. */
  unchanged: number;
  /** O contato não tem telefone — não apagamos o que já estiver lá. */
  noPhone: number;
  errors: Array<{ opportunityId: string; message: string }>;
  dryRun: boolean;
  /** O que mudaria/mudou, para a corretora conferir antes de confiar. */
  changes: Array<{ opportunityId: string; name: string; from: string; to: string }>;
}

/** Normaliza para comparar: o GHL às vezes devolve o número com espaços. */
const same = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

export async function syncOpportunityPhones(params: {
  locationId: string;
  dryRun?: boolean;
  /** Teto de escritas por execução — protege contra um engano em massa. */
  limit?: number;
}): Promise<PhoneSyncResult> {
  const { locationId, dryRun = false, limit = 500 } = params;

  const field = await findOpportunityField(locationId, serverEnv.oppPhoneFieldKey);
  const result: PhoneSyncResult = {
    field: field ? { id: field.id, fieldKey: field.fieldKey, name: field.name } : null,
    scanned: 0,
    updated: 0,
    unchanged: 0,
    noPhone: 0,
    errors: [],
    dryRun,
    changes: [],
  };

  if (!field) {
    throw new Error(
      `Campo "${serverEnv.oppPhoneFieldKey}" não existe nas oportunidades desta conta. ` +
        `Crie-o no GHL (Settings → Custom Fields → Opportunity) ou aponte GHL_OPP_PHONE_FIELD_KEY para o campo certo.`,
    );
  }

  for await (const opp of iterateOpportunitiesRaw(locationId)) {
    result.scanned++;
    const phone = (opp.contact?.phone ?? "").trim();
    if (!phone) {
      // Contato sem telefone: deixamos o valor atual em paz. Apagar seria
      // destruir um dado que alguém pode ter preenchido à mão.
      result.noPhone++;
      continue;
    }

    const current = readOppFieldValue(opp, field.id);
    if (same(current, phone)) {
      result.unchanged++;
      continue;
    }

    result.changes.push({
      opportunityId: opp.id,
      name: opp.name ?? "(sem nome)",
      from: current,
      to: phone,
    });

    if (dryRun) continue;
    if (result.updated >= limit) continue;

    try {
      await setOpportunityField({ locationId, opportunityId: opp.id, fieldId: field.id, value: phone });
      result.updated++;
    } catch (e) {
      // Uma oportunidade que falha não derruba a varredura inteira.
      result.errors.push({ opportunityId: opp.id, message: (e as Error).message });
    }
  }

  return result;
}
