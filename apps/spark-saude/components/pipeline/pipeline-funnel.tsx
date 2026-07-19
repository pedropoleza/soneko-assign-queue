"use client";

import * as React from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-state";
import { SERIES_BLUE, CHART_TRACK } from "@/components/charts/palette";
import { cn, formatMoneyBR } from "@/lib/utils";
import type { PipelineView } from "@/lib/types";

/**
 * Stage-distribution "funnel" for one pipeline: where the deals actually sit,
 * with count + share of the pipeline. Click a stage to reveal its deals and
 * jump to the contact in GHL. Far more actionable than a static kanban.
 */
export function PipelineFunnel({
  view,
  ghlUrlFor,
}: {
  view: PipelineView;
  ghlUrlFor?: (contactId?: string) => string | undefined;
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  const max = Math.max(1, ...view.buckets.map((b) => b.count));

  const busiest = view.buckets.reduce((a, b) => (b.count > a.count ? b : a), view.buckets[0]);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 border-b px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{view.pipeline.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {view.total} {view.total === 1 ? "negócio" : "negócios"}
            {view.total > 0 && busiest ? ` · concentração em "${busiest.stage.name}"` : ""}
          </p>
        </div>
      </div>

      {view.total === 0 ? (
        <div className="p-3">
          <EmptyState title="Nenhuma oportunidade nesta pipeline" hint="Os negócios aparecem aqui conforme avançam nas etapas." />
        </div>
      ) : (
        <div className="space-y-0.5 p-3">
          {view.buckets.map((b) => {
            const w = b.count > 0 ? Math.max((b.count / max) * 100, 2) : 0;
            const pct = view.total > 0 ? Math.round((b.count / view.total) * 100) : 0;
            const isOpen = open === b.stage.id;
            const canOpen = b.count > 0;
            return (
              <div key={b.stage.id}>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={() => setOpen(isOpen ? null : b.stage.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                    canOpen ? "hover:bg-muted" : "cursor-default opacity-70",
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-90",
                      !canOpen && "opacity-0",
                    )}
                  />
                  <span className="w-40 shrink-0 truncate text-sm" title={b.stage.name}>
                    {b.stage.name}
                  </span>
                  <div className="h-6 flex-1 overflow-hidden rounded-md" style={{ background: CHART_TRACK }}>
                    <div className="h-full rounded-md" style={{ width: `${w}%`, background: SERIES_BLUE }} />
                  </div>
                  <span className="w-10 text-right text-sm font-medium tabular-nums">{b.count}</span>
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                </button>

                {isOpen && b.opportunities.length > 0 ? (
                  <ul className="my-1 ml-[3.25rem] divide-y rounded-md border bg-muted/30">
                    {b.opportunities.map((o) => {
                      const url = ghlUrlFor?.(o.contactId);
                      return (
                        <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="min-w-0 truncate">{o.name}</span>
                          <div className="flex shrink-0 items-center gap-3">
                            {o.monetaryValue ? (
                              <span className="text-xs tabular-nums text-muted-foreground">{formatMoneyBR(o.monetaryValue)}</span>
                            ) : null}
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir contato no GHL"
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-primary"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
