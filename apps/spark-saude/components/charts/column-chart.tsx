"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SERIES_BLUE } from "./palette";
import type { ChartDatum } from "@/lib/types";

/**
 * Vertical columns for magnitude-over-time (renovações por mês). Single hue —
 * identity comes from the axis labels, not color. 4px rounded cap at the top,
 * grows from one baseline; value on the cap; hover dims the others.
 */
export function ColumnChart({
  data,
  color = SERIES_BLUE,
  height = 176,
}: {
  data: ChartDatum[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [hover, setHover] = React.useState<number | null>(null);

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max((d.value / max) * 100, 3) : 0;
          return (
            <div
              key={i}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className={cn("text-xs font-medium tabular-nums", d.value > 0 ? "text-foreground" : "text-transparent")}>
                {d.value}
              </span>
              <div
                className="w-full max-w-[24px] rounded-t-[4px]"
                style={{
                  height: `${h}%`,
                  background: color,
                  opacity: hover == null || hover === i ? 1 : 0.5,
                  transition: "opacity .15s ease",
                }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 border-t pt-2">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-xs capitalize text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
