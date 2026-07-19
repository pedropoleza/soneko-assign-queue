import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card wrapper for a chart — plain-text title, optional subtitle, no icons. */
export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className={cn("flex-1 px-5 pb-5 pt-1", bodyClassName)}>{children}</div>
    </Card>
  );
}
