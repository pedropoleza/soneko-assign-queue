import type { ReactNode } from 'react';

/**
 * Rosca de participação: quem trouxe as mensagens que chegaram.
 *
 * Só três fatias coloridas. A paleta categórica (azul/laranja/água) foi
 * validada para daltonismo em todos os pares; a partir da quarta o par
 * amarelo/laranja quebraria o piso, então o resto vira "Outros" — neutro e
 * hachurado, para não depender de cor. O nome aparece escrito ao lado de cada
 * ponto, então a identidade nunca é só cor.
 */
export const SERIES = ['#2A78D6', '#EB6834', '#1BAF7A'] as const;
export const OTHER = '#94A3B8';

export type Slice = { id: string; label: string; value: number };

export function Donut({
  slices,
  total,
  caption,
  size = 148,
}: {
  slices: Slice[];
  total: number;
  caption: ReactNode;
  size?: number;
}) {
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && slices.length > 1 ? 3 : 0; // respiro entre fatias

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const len = total > 0 ? (s.value / total) * c : 0;
    const arc = { ...s, color: i < SERIES.length ? SERIES[i] : OTHER, len, offset };
    offset += len;
    return arc;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={String(caption)}>
      <defs>
        <pattern id="donut-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={OTHER} opacity="0.35" />
          <line x1="0" y1="0" x2="0" y2="6" stroke={OTHER} strokeWidth="2.5" />
        </pattern>
      </defs>

      <g transform={`translate(${size / 2} ${size / 2}) rotate(-90)`}>
        <circle r={r} fill="none" strokeWidth={stroke} className="stroke-surface-2" />
        {total > 0 &&
          arcs.map((a, i) => (
            <circle
              key={a.id}
              r={r}
              fill="none"
              strokeWidth={stroke}
              stroke={i >= SERIES.length ? 'url(#donut-hatch)' : a.color}
              strokeDasharray={`${Math.max(0, a.len - gap)} ${c}`}
              strokeDashoffset={-a.offset}
            >
              <title>{`${a.label}: ${a.value} de ${total} mensagens`}</title>
            </circle>
          ))}
      </g>

      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        className="num fill-ink"
        style={{ fontSize: 26, fontWeight: 600 }}
      >
        {total}
      </text>
      <text x="50%" y="62%" textAnchor="middle" className="fill-ink-3" style={{ fontSize: 11 }}>
        {caption}
      </text>
    </svg>
  );
}

/** Marcador de série usado na legenda — mesma cor e mesma textura da fatia. */
export function SeriesDot({ index }: { index: number }) {
  if (index >= SERIES.length) {
    return (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
        style={{
          backgroundColor: OTHER,
          backgroundImage: `repeating-linear-gradient(45deg, ${OTHER} 0 2px, rgba(255,255,255,.55) 2px 4px)`,
        }}
      />
    );
  }
  return (
    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: SERIES[index] }} />
  );
}
