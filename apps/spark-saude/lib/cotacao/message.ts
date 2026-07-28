import type { QuoteProfile } from "./types";

/**
 * The message the broker sends with the proposal link.
 *
 * This is her real text, kept word for word — including the closing caveat that
 * the final price tends to come out lower because the quoting system doesn't
 * recognize the children's ages. Only the variable parts (year, household,
 * zipcode, income) are filled from the quote, so what she sends stays exactly
 * what her clients already recognize.
 */

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "Mas 49 e 17 anos, Fem 57 e 19 anos" — ages grouped by gender, as she writes it. */
function describePeople(people: QuoteProfile["people"]): string {
  const groups: Array<{ label: string; ages: number[] }> = [
    { label: "Mas", ages: people.filter((p) => p.gender === "Male").map((p) => p.age) },
    { label: "Fem", ages: people.filter((p) => p.gender === "Female").map((p) => p.age) },
  ];

  return groups
    .filter((g) => g.ages.length > 0)
    .map((g) => {
      const ages = g.ages.sort((a, b) => b - a);
      const list = ages.length === 1 ? `${ages[0]}` : `${ages.slice(0, -1).join(", ")} e ${ages[ages.length - 1]}`;
      return `${g.label} ${list} anos`;
    })
    .join(", ");
}

export function buildClientMessage(profile: QuoteProfile): string {
  const n = profile.people.length;
  const pessoas = n === 1 ? "1 pessoa" : `${n} pessoas`;
  const seguro = n === 1 ? "Seguro para 1 pessoa" : `Seguro para ${n} pessoas`;

  return [
    `Segue cotações para seguro saúde do Marketplace/Obamacare para ${profile.year}, considerando:`,
    ``,
    `• Família de ${pessoas}/${seguro} (${describePeople(profile.people)})`,
    `• Zipcode: ${profile.zipcode}`,
    `• Renda familiar anual de ${profile.year} estimada a ser declarada no Imposto de Renda em ${
      profile.year + 1
    } de ${money(profile.income)}`,
    ``,
    `*Quando fizermos o seguro provavelmente o valor ficará menor, pois durante a cotação o sistema não reconhece as idades das crianças`,
  ].join("\n");
}
