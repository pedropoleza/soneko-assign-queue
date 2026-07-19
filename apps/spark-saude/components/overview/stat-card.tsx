import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "green" | "amber" | "violet" | "gray";

/**
 * Tone gives each metric a color identity so the KPI row reads as a guide — the
 * eye can group and prioritize by color — instead of a monotonous grid of
 * identical cards. `chip` tints the icon badge, `strip` is the left accent rail,
 * `text` colors the value on the highlighted card.
 */
const TONE: Record<StatTone, { chip: string; strip: string; text: string }> = {
  blue: { chip: "bg-[rgba(21,94,239,0.10)] text-primary", strip: "bg-primary", text: "text-primary" },
  green: { chip: "bg-[rgba(18,183,106,0.12)] text-[#0E9F6E]", strip: "bg-[#12B76A]", text: "text-[#0E9F6E]" },
  amber: { chip: "bg-[rgba(247,144,9,0.12)] text-[#B54708]", strip: "bg-[#F79009]", text: "text-[#B54708]" },
  violet: { chip: "bg-[rgba(124,58,237,0.12)] text-[#6D28D9]", strip: "bg-[#7C3AED]", text: "text-[#6D28D9]" },
  gray: { chip: "bg-muted text-muted-foreground", strip: "bg-border", text: "text-foreground" },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  accent = false,
  onClick,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  accent?: boolean;
  onClick?: () => void;
}) {
  const t = TONE[tone ?? (accent ? "blue" : "gray")];
  const clickable = !!onClick;
  return (
    <Card
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      className={cn(
        "group relative overflow-hidden py-4 pl-6 pr-4",
        clickable && "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
      )}
    >
      {/* left tone rail — the metric's color identity */}
      <span className={cn("absolute inset-y-0 left-0 w-1", t.strip)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105", t.chip)}>
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-2.5 text-[26px] font-semibold leading-none tracking-tight", accent && t.text)}>{value}</p>
      <div className="mt-2.5 flex items-center justify-between">
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : <span />}
        {clickable ? (
          <span className="text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Ver contatos →
          </span>
        ) : null}
      </div>
    </Card>
  );
}
