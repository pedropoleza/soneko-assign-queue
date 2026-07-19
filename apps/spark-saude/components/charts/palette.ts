/**
 * Chart palette — professional, cohesive, brand-aligned.
 * - Magnitude (bars/columns/funnel): a single brand blue.
 * - Ordinal progressions (plano tiers): a light→dark blue ramp.
 * - Status (documentação): refined, muted semantic tones, always with labels.
 */

// Matches the UI --primary token.
export const SERIES_BLUE = "#2663f2";
export const SERIES_BLUE_SOFT = "#e9effe";

export const CHART_GRID = "#eef1f6";
export const CHART_TRACK = "#f2f5fa";
export const CHART_AXIS = "#d9dfe8";

// Ordinal blue ramp (light → dark). Lightest clears ~2:1 on white.
export const BLUE_RAMP = ["#83a8f6", "#4f84f2", "#2663f2", "#1a4bc4", "#143a95"];

const PLANO_ORDER = ["Bronze", "Silver", "Gold", "Platinum"];

/** Plano tiers coloured by rank along the blue ramp; extras stay neutral. */
export function planoColors(labels: string[]): string[] {
  return labels.map((l) => {
    const idx = PLANO_ORDER.indexOf(l);
    if (idx >= 0) return BLUE_RAMP[Math.min(idx, BLUE_RAMP.length - 1)]!;
    return "#c6cfdd"; // Outros / Sem plano
  });
}

// Documentação — muted semantic tones (good → bad), shipped with legend labels.
export const DOC_COLORS: Record<string, string> = {
  Recebida: "#0e9f6e",
  Parcial: "#d98a0b",
  Pendente: "#e24d5b",
  "Sem info": "#a7b1c0",
};

export function colorsByMap(labels: string[], map: Record<string, string>, fallback = "#a7b1c0"): string[] {
  return labels.map((l) => map[l] ?? fallback);
}
