"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SERIES_BLUE, CHART_GRID } from "./palette";
import type { ChartDatum } from "@/lib/types";

/**
 * Vertical columns for magnitude-over-time. Single hue; identity from the axis.
 * Y-axis ticks + hairline gridlines carry the scale; values live in the hover
 * tooltip so the plot stays quiet. 4px rounded caps, one baseline.
 */
export function ColumnChart({
  data,
  color = SERIES_BLUE,
  height = 180,
  unit = "",
}: {
  data: ChartDatum[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  const rawMax = Math.max(1, ...data.map((d) => d.value));
  const niceMax = rawMax <= 4 ? rawMax : Math.ceil(rawMax / 2) * 2;
  const ticks = [0, Math.round(niceMax / 2), niceMax].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div>
      <div className="flex gap-3">
        <div className="relative w-5 shrink-0" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ bottom: `${(t / niceMax) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t"
              style={{ bottom: `${(t / niceMax) * 100}%`, borderColor: CHART_GRID }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-2">
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max((d.value / niceMax) * 100, 1.5) : 0;
              return (
                <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-[22px] rounded-t-[4px] transition-[filter] group-hover:brightness-90"
                    style={{ height: `${h}%`, background: color }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    <span className="capitalize">{d.label}</span>: {d.value}
                    {unit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <div className="w-5 shrink-0" />
        <div className="flex flex-1 gap-2">
          {data.map((d, i) => (
            <span key={i} className={cn("flex-1 text-center text-xs capitalize text-muted-foreground")}>
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
