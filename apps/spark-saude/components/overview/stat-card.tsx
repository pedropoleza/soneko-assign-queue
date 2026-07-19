import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  accent = false,
  onClick,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <Card
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      className={cn(
        "group relative overflow-hidden px-5 py-4",
        accent && "ring-1 ring-primary/20",
        clickable && "cursor-pointer transition-all hover:border-primary/30 hover:shadow-card-hover",
      )}
    >
      {accent ? <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-[26px] font-semibold leading-none tracking-tight", accent && "text-primary")}>{value}</p>
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
