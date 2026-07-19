"use client";

import * as React from "react";
import { SERIES_BLUE, CHART_TRACK } from "./palette";
import type { ChartDatum } from "@/lib/types";

/**
 * Horizontal bars for magnitude across categories. Each bar sits on a subtle
 * full-width track; category on the left, value at the tip. Single hue.
 */
export function HBarChart({ data, color = SERIES_BLUE }: { data: ChartDatum[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className="space-y-3">
      {data.map((d, i) => {
        const w = d.value > 0 ? Math.max((d.value / max) * 100, 2) : 0;
        return (
          <li key={i} className="group flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 truncate text-muted-foreground" title={d.label}>
              {d.label}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: CHART_TRACK }}>
              <div
                className="h-full rounded-full transition-[filter] group-hover:brightness-95"
                style={{ width: `${w}%`, minWidth: d.value > 0 ? 6 : 0, background: color }}
              />
            </div>
            <span className="w-6 text-right font-medium tabular-nums text-foreground">{d.value}</span>
          </li>
        );
      })}
    </ul>
  );
}
