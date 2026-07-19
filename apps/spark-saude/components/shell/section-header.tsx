import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Centered section divider in a glassmorphism style: a frosted pill (translucent
 * white gradient + backdrop blur + soft edge) sits on a hairline gradient rule
 * that runs across the width, with a branded blue accent dot. Gives each section
 * a clear, objective break without a heavy heading.
 */
export function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center py-1", className)}>
      {/* hairline rule behind the pill */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent"
      />
      {/* frosted glass pill */}
      <div className="relative inline-flex items-center gap-2.5 rounded-full border border-white/80 bg-gradient-to-b from-white/75 to-white/45 px-5 py-2 shadow-[0_6px_18px_-8px_rgba(16,24,40,0.22)] ring-1 ring-inset ring-white/50 backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(21,94,239,0.16)]" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/85">{title}</h2>
      </div>
    </div>
  );
}
