/**
 * Chart palette — professional, cohesive, brand-aligned.
 * - Magnitude (bars/columns/funnel): a single brand blue.
 * - Ordinal progressions (plano tiers): a light→dark blue ramp.
 * - Status (documentação): refined, muted semantic tones, always with labels.
 */

// Matches the UI --primary token (GHL blue #155EEF).
export const SERIES_BLUE = "#155EEF";
export const SERIES_BLUE_SOFT = "#e7eefe";

export const CHART_GRID = "#eef1f6";
export const CHART_TRACK = "#eef2f8";
export const CHART_AXIS = "#d9dfe8";

// Ordinal blue ramp (light → dark) around the GHL blue.
export const BLUE_RAMP = ["#84adf5", "#4f88f0", "#155EEF", "#1146b8", "#0c3286"];

// Categorical (distinct identity) — fixed order, never cycled.
export const CATEGORICAL = ["#155EEF", "#7A5AF8", "#06AED4", "#12B76A", "#F79009", "#EE46BC"];

export function categoricalFor(labels: string[]): string[] {
  return labels.map((_, i) => CATEGORICAL[i % CATEGORICAL.length]!);
}

const PLANO_ORDER = ["Bronze", "Silver", "Gold", "Platinum"];

/** Plano tiers coloured by rank along the blue ramp; extras stay neutral. */
export function planoColors(labels: string[]): string[] {
  return labels.map((l) => {
    const idx = PLANO_ORDER.indexOf(l);
    if (idx >= 0) return BLUE_RAMP[Math.min(idx, BLUE_RAMP.length - 1)]!;
    return "#cbd5e1"; // Outros / Sem plano
  });
}

// Documentação — GHL semantic tones (good → bad), shipped with legend labels.
export const DOC_COLORS: Record<string, string> = {
  Recebida: "#12B76A",
  Parcial: "#F79009",
  Pendente: "#F04438",
  "Sem info": "#98A2B3",
};

export function colorsByMap(labels: string[], map: Record<string, string>, fallback = "#a7b1c0"): string[] {
  return labels.map((l) => map[l] ?? fallback);
}
