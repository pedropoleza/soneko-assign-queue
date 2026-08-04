import { dict, type Dict } from "./i18n";
import type { QuoteProfile } from "./types";

/**
 * The message the broker sends with the proposal link.
 *
 * The Portuguese version is her real text, kept word for word — including the
 * closing caveat that the final price tends to come out lower because the
 * quoting system doesn't recognize the children's ages. Spanish and English
 * follow the same structure and tone for the clients who read those instead.
 * Only the variable parts (year, household, zipcode, income) are filled in.
 */

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * "Mas 49 e 17 anos, Fem 57 e 19 anos" — idades por gênero, como ela escreve.
 * Exportada porque o PDF repete as mesmas premissas, com as mesmas palavras.
 */
export function describePeople(people: QuoteProfile["people"], d: Dict): string {
  const groups: Array<{ label: string; ages: number[] }> = [
    { label: d.male, ages: people.filter((p) => p.gender === "Male").map((p) => p.age) },
    { label: d.female, ages: people.filter((p) => p.gender === "Female").map((p) => p.age) },
  ];

  return groups
    .filter((g) => g.ages.length > 0)
    .map((g) => {
      const ages = [...g.ages].sort((a, b) => b - a);
      const list =
        ages.length === 1 ? `${ages[0]}` : `${ages.slice(0, -1).join(", ")} ${d.and} ${ages[ages.length - 1]}`;
      return `${g.label} ${list} ${d.yearsOld}`;
    })
    .join(", ");
}

export function buildClientMessage(profile: QuoteProfile): string {
  const d = dict(profile.idioma);
  const n = profile.people.length;

  return [
    d.msg.intro(profile.year),
    ``,
    d.msg.household(n, describePeople(profile.people, d)),
    d.msg.zip(profile.zipcode),
    d.msg.income(profile.year, money(profile.income)),
    ``,
    d.msg.caveat,
  ].join("\n");
}
