"use client";

import * as React from "react";
import { SERIES_BLUE } from "./palette";
import type { ChartDatum } from "@/lib/types";

/**
 * Horizontal bars for magnitude across categories (carteira por seguradora).
 * Single hue; category on the left, value at the bar tip; 4px rounded data-end.
 */
export function HBarChart({ data, color = SERIES_BLUE }: { data: ChartDatum[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [hover, setHover] = React.useState<number | null>(null);

  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => {
        const w = d.value > 0 ? Math.max((d.value / max) * 100, 2) : 0;
        return (
          <li
            key={i}
            className="flex items-center gap-3 text-sm"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-32 shrink-0 truncate text-muted-foreground" title={d.label}>
              {d.label}
            </span>
            <div className="flex-1">
              <div
                className="h-5 rounded-l-[2px] rounded-r-[4px]"
                style={{
                  width: `${w}%`,
                  minWidth: d.value > 0 ? 8 : 0,
                  background: color,
                  opacity: hover == null || hover === i ? 1 : 0.5,
                  transition: "opacity .15s ease",
                }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
            <span className="w-6 text-right font-medium tabular-nums text-foreground">{d.value}</span>
          </li>
        );
      })}
    </ul>
  );
}
