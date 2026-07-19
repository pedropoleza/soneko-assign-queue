import * as React from "react";
import { Card } from "@/components/ui/card";
import { InfoButton } from "@/components/ui/info-button";
import { cn } from "@/lib/utils";

/** Card wrapper for a chart — title (+ optional "i" explainer), subtitle, filter slot. */
export function ChartCard({
  title,
  subtitle,
  info,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  info?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
            {info ? <InfoButton text={info} /> : null}
          </div>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className={cn("flex flex-1 flex-col justify-center px-5 pb-5 pt-1", bodyClassName)}>{children}</div>
    </Card>
  );
}
