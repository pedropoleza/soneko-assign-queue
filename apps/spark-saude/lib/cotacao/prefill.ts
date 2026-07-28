import type { Contact } from "@/lib/types";
import type { QuotePerson, QuoteProfile } from "./types";

/**
 * Turn a real GHL contact into a ready-to-quote household (docs/cotacao.md §4,
 * Ponta A step 1: "puxa nome e dados da carteira via GHL").
 *
 * The CRM already holds what the CMS needs — renda_casa, pessoas_na_casa, the
 * date of birth and the address. Re-typing it is where quoting loses time and
 * gains typos, so picking a contact should fill the form, not just label it.
 * Every value is a SUGGESTION the broker can override before searching.
 */

/** Age at a given date, from an ISO birth date. */
export function ageFrom(dob: string, at = new Date()): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = at.getUTCFullYear() - d.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - d.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < d.getUTCDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}

/** Normalize whatever the CRM stored into an ISO YYYY-MM-DD, or null. */
function isoDate(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** US zip from the contact's postal code (5-digit; ignores the +4 suffix). */
function zipOf(contact: Contact): string | null {
  const raw = (contact.postalCode ?? "").trim();
  const m = raw.match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

export interface PrefillResult {
  profile: Partial<QuoteProfile>;
  /** Which fields actually came from the CRM — the UI tells the broker. */
  filled: string[];
  /** Things worth confirming before searching (e.g. we only know the holder's age). */
  notes: string[];
}

export function prefillFromContact(contact: Contact, year: number): PrefillResult {
  const filled: string[] = [];
  const notes: string[] = [];
  const profile: Partial<QuoteProfile> = {
    contactId: contact.id,
    contactName: contact.name,
  };

  const zip = zipOf(contact);
  if (zip) {
    profile.zipcode = zip;
    filled.push("CEP");
  }

  const state = (contact.state ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(state)) {
    profile.state = state;
    filled.push("Estado");
  }

  const income = num(contact.fields.rendaCasa);
  if (income != null && income > 0) {
    profile.income = income;
    filled.push("Renda");
  }

  // The policyholder: date of birth (native field or custom) gives exact-age rating.
  const dob = isoDate(contact.dateOfBirth) ?? isoDate(contact.fields.dataNascimento);
  const holder: QuotePerson = {
    age: (dob ? ageFrom(dob) : null) ?? 30,
    dob,
    gender: "Male",
    relationship: "Self",
    aptcEligible: true,
    usesTobacco: false,
    utilizationLevel: "Medium",
  };
  if (dob) {
    filled.push("Data de nascimento");
  } else {
    notes.push("Sem data de nascimento no CRM — confirme a idade do titular.");
  }

  // Household size tells us HOW MANY people to quote, but not who they are.
  const householdSize = num(contact.fields.pessoasNoSeguro) ?? num(contact.fields.pessoasNaCasa);
  const size = householdSize != null ? Math.max(1, Math.min(12, Math.round(householdSize))) : 1;
  const people: QuotePerson[] = [holder];
  for (let i = 1; i < size; i++) {
    people.push({
      age: i === 1 ? 30 : 10,
      dob: null,
      gender: i === 1 ? "Female" : "Male",
      relationship: i === 1 ? "Spouse" : "Child",
      aptcEligible: true,
      usesTobacco: false,
      utilizationLevel: "Medium",
    });
  }
  profile.people = people;
  profile.year = year;

  if (householdSize != null) {
    filled.push(`Pessoas (${size})`);
    if (size > 1) {
      notes.push("Idades dos dependentes são estimativas — informe a data de nascimento de cada um para o preço sair correto.");
    }
  } else {
    notes.push("Sem 'pessoas no seguro' no CRM — adicione os dependentes manualmente.");
  }

  return { profile, filled, notes };
}
