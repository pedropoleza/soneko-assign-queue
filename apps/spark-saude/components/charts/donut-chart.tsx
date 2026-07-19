"use client";

import * as React from "react";
import type { ChartDatum } from "@/lib/types";

/**
 * Donut for categorical identity (plano, documentação). Legend always present;
 * hover a segment (or legend row) to read its label/value in the center.
 * 2px surface gap between segments; text uses ink tokens, not the series color.
 */
export function DonutChart({
  data,
  colors,
  centerLabel = "Total",
}: {
  data: ChartDatum[];
  colors: string[];
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [hover, setHover] = React.useState<number | null>(null);

  const size = 168;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const gap = total > 0 && data.length > 1 ? 1.4 : 0;

  let acc = 0;
  const segs = data.map((d, i) => {
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    const seg = { i, pct, offset: acc, color: colors[i] ?? "#9aa0aa", label: d.label, value: d.value };
    acc += pct;
    return seg;
  });

  const active = hover != null ? segs[hover] : null;
  const centerValue = active ? active.value : total;
  const centerText = active ? active.label : centerLabel;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(214 22% 93%)" strokeWidth={stroke} />
          {total > 0 &&
            segs.map((s) => {
              const len = Math.max(s.pct - gap, 0.5);
              return (
                <circle
                  key={s.i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hover === s.i ? stroke + 3 : stroke}
                  pathLength={100}
                  strokeDasharray={`${len} ${100 - len}`}
                  strokeDashoffset={-s.offset}
                  onMouseEnter={() => setHover(s.i)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    cursor: "pointer",
                    transition: "stroke-width .15s ease, opacity .15s ease",
                    opacity: hover == null || hover === s.i ? 1 : 0.45,
                  }}
                />
              );
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold leading-none">{centerValue}</span>
          <span className="mt-1 max-w-[96px] text-center text-[11px] leading-tight text-muted-foreground">{centerText}</span>
        </div>
      </div>

      <ul className="grid w-full gap-1.5 sm:min-w-[132px]">
        {segs.map((s) => (
          <li
            key={s.i}
            className="flex cursor-default items-center gap-2 text-sm"
            onMouseEnter={() => setHover(s.i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 truncate text-foreground">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">{s.value}</span>
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
