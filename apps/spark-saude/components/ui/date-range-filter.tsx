"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/utils";

export interface DateRangeValue {
  key: string;
  label: string;
  from?: string; // ISO yyyy-mm-dd
  to?: string;
}

export interface DatePreset {
  key: string;
  label: string;
  compute: () => { from?: string; to?: string };
}

/**
 * GoHighLevel-style date filter: an outline button showing the active range,
 * opening a popover with a preset list plus a custom range. Fully controlled.
 */
export function DateRangeFilter({
  value,
  onChange,
  presets,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  presets: DatePreset[];
}) {
  const [open, setOpen] = React.useState(false);
  const [showCustom, setShowCustom] = React.useState(value.key === "custom");
  const [from, setFrom] = React.useState(value.from ?? "");
  const [to, setTo] = React.useState(value.to ?? "");

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[180px] truncate">{value.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-64 rounded-lg border bg-background p-1.5 shadow-card-hover focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div className="flex flex-col">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onChange({ key: p.key, label: p.label, ...p.compute() });
                  setShowCustom(false);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
                  value.key === p.key && "font-medium text-primary",
                )}
              >
                {p.label}
                {value.key === p.key ? <Check className="h-4 w-4" /> : null}
              </button>
            ))}
          </div>

          <div className="mt-1 border-t pt-1">
            <button
              type="button"
              onClick={() => setShowCustom((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-muted",
                value.key === "custom" && "font-medium text-primary",
              )}
            >
              Personalizado
              {value.key === "custom" ? <Check className="h-4 w-4" /> : null}
            </button>
            {showCustom ? (
              <div className="space-y-2 px-2.5 pb-1 pt-1.5">
                <label className="block text-xs text-muted-foreground">
                  De
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-8" />
                </label>
                <label className="block text-xs text-muted-foreground">
                  Até
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-8" />
                </label>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!from || !to}
                  onClick={() => {
                    onChange({ key: "custom", label: `${formatDateBR(from)} – ${formatDateBR(to)}`, from, to });
                    setOpen(false);
                  }}
                >
                  Aplicar
                </Button>
              </div>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
