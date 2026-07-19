"use client";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string | number> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string | number>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div className={cn("inline-flex items-center rounded-md border bg-muted p-0.5", className)}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors",
            opt.value === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
