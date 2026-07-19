"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRangeValue, DatePreset } from "./date-range-filter";

/**
 * Compact per-chart date filter. `null` value = follow the dashboard's global
 * range; picking a preset detaches this chart to its own range.
 */
export function ChartDateFilter({
  value,
  global,
  onChange,
  presets,
}: {
  value: DateRangeValue | null;
  global: DateRangeValue;
  onChange: (v: DateRangeValue | null) => void;
  presets: DatePreset[];
}) {
  const [open, setOpen] = React.useState(false);
  const following = value === null;
  const label = following ? global.label : value.label;

  const row = "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted",
            following ? "text-muted-foreground" : "border-primary/30 text-primary",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="max-w-[130px] truncate">{label}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 rounded-lg border bg-background p-1.5 shadow-card-hover focus:outline-none"
        >
          <button type="button" onClick={() => { onChange(null); setOpen(false); }} className={cn(row, following && "font-medium text-primary")}>
            Seguir o painel
            {following ? <Check className="h-4 w-4" /> : null}
          </button>
          <div className="my-1 border-t" />
          {presets
            .filter((p) => p.key !== "all")
            .map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => { onChange({ key: p.key, label: p.label, ...p.compute() }); setOpen(false); }}
                className={cn(row, value?.key === p.key && "font-medium text-primary")}
              >
                {p.label}
                {value?.key === p.key ? <Check className="h-4 w-4" /> : null}
              </button>
            ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
