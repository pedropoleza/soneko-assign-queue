/**
 * Chart palette — validated with the dataviz skill's checker against a white
 * card surface (categorical set passes CVD/normal-vision; low-contrast slots are
 * mitigated by always shipping legends + direct value labels).
 */

export const SERIES_BLUE = "#2a78d6";

// Categorical (identity) — fixed order, never cycled. Used for donut segments.
export const CATEGORICAL = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834"];

// Status tones (reserved; always shipped with a label in the legend).
export const DOC_COLORS: Record<string, string> = {
  Recebida: "#0ca30c",
  Parcial: "#fab219",
  Pendente: "#d03b3b",
  "Sem info": "#9aa0aa",
};

export const RENEWAL_COLORS: Record<string, string> = {
  Pendente: "#fab219",
  Avisado: "#2a78d6",
  Feito: "#0ca30c",
  "Não renovou": "#d03b3b",
  "Sem status": "#9aa0aa",
};

export function categoricalFor(labels: string[]): string[] {
  return labels.map((_, i) => CATEGORICAL[i % CATEGORICAL.length]!);
}

export function colorsByMap(labels: string[], map: Record<string, string>, fallback = "#9aa0aa"): string[] {
  return labels.map((l) => map[l] ?? fallback);
}
