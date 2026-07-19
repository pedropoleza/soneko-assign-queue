"use client";

import * as React from "react";
import type { ChartDatum } from "@/lib/types";

/**
 * Donut for categorical/ordinal identity (plano, documentação). Thin ring with
 * rounded caps, a prominent center metric, and a values legend. Hover a segment
 * or legend row to read it in the center. Text uses ink tokens, never the hue.
 */
export function DonutChart({
  data,
  colors,
  centerLabel = "Total",
  onSelect,
}: {
  data: ChartDatum[];
  colors: string[];
  centerLabel?: string;
  onSelect?: (label: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [hover, setHover] = React.useState<number | null>(null);

  const size = 176;
  const stroke = 15;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const multi = data.filter((d) => d.value > 0).length > 1;
  const gap = total > 0 && multi ? 2.4 : 0;

  let acc = 0;
  const segs = data.map((d, i) => {
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    const seg = { i, pct, offset: acc, color: colors[i] ?? "#98A2B3", label: d.label, value: d.value };
    acc += pct;
    return seg;
  });

  const active = hover != null ? segs[hover] : null;
  const centerValue = active ? active.value : total;
  const centerText = active ? active.label : centerLabel;
  const centerPct = active && total > 0 ? ` · ${Math.round((active.value / total) * 100)}%` : "";

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f3f8" strokeWidth={stroke} />
          {total > 0 &&
            segs
              .filter((s) => s.value > 0)
              .map((s) => {
                const len = Math.max(s.pct - gap, multi ? 1 : s.pct);
                return (
                  <circle
                    key={s.i}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={hover === s.i ? stroke + 4 : stroke}
                    strokeLinecap={multi ? "round" : "butt"}
                    pathLength={100}
                    strokeDasharray={`${len} ${100 - len}`}
                    strokeDashoffset={-s.offset}
                    onMouseEnter={() => setHover(s.i)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onSelect?.(s.label)}
                    style={{
                      cursor: "pointer",
                      transition: "stroke-width .18s ease, opacity .18s ease",
                      opacity: hover == null || hover === s.i ? 1 : 0.35,
                    }}
                  />
                );
              })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] font-semibold leading-none tracking-tight">{centerValue}</span>
          <span className="mt-1.5 max-w-[104px] text-center text-[11px] font-medium leading-tight text-muted-foreground">
            {centerText}
            {centerPct}
          </span>
        </div>
      </div>

      <ul className="grid w-full gap-0.5 sm:min-w-[148px]">
        {segs.map((s) => (
          <li
            key={s.i}
            className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${onSelect ? "cursor-pointer" : "cursor-default"}`}
            onMouseEnter={() => setHover(s.i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect?.(s.label)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 truncate text-foreground">{s.label}</span>
            <span className="font-medium tabular-nums text-foreground">{s.value}</span>
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
