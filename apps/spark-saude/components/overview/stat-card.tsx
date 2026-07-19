import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className={cn("relative overflow-hidden px-5 py-4", accent && "ring-1 ring-primary/20")}>
      {accent ? <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-[26px] font-semibold leading-none tracking-tight", accent && "text-primary")}>{value}</p>
      {hint ? <p className="mt-2.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
