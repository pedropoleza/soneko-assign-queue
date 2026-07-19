import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width section bar — an unmistakable divider between dashboard blocks.
 *
 * A frosted, lightly brand-tinted band spans the whole content width, with a
 * solid accent strip on the left and an uppercase, letter-spaced label. It is
 * deliberately obvious: distinct from both the gray page and the white cards
 * below, so an average user parses "new section here" at a glance (the eye
 * lands on the accent + label at the top-left of the band).
 */
export function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-xl border border-[rgba(21,94,239,0.16)] bg-gradient-to-r from-[rgba(21,94,239,0.10)] via-[rgba(21,94,239,0.05)] to-[rgba(21,94,239,0.03)] px-4 py-3 shadow-[0_2px_12px_-6px_rgba(16,24,40,0.16)] backdrop-blur-md",
        className,
      )}
    >
      {/* solid brand accent strip — the anchor the eye locks onto */}
      <span aria-hidden className="h-6 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_rgba(21,94,239,0.14)]" />
      <h2 className="text-[13px] font-semibold uppercase leading-none tracking-[0.13em] text-foreground">{title}</h2>
    </div>
  );
}
