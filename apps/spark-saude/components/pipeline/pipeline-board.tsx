import type { PipelineView } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatMoneyBR } from "@/lib/utils";

/** Renders one funnel. Columns come straight from the live pipeline definition. */
export function PipelineBoard({ view }: { view: PipelineView }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{view.pipeline.name}</h2>
        <span className="text-xs text-muted-foreground">
          {view.total} {view.total === 1 ? "negócio" : "negócios"}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {view.buckets.map((b) => (
          <div key={b.stage.id} className="w-64 shrink-0 rounded-lg border bg-muted/40">
            <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-2">
              <span className="truncate text-sm font-medium" title={b.stage.name}>
                {b.stage.name}
              </span>
              <Badge tone={b.count > 0 ? "blue" : "gray"}>{b.count}</Badge>
            </div>
            <div className="min-h-[64px] space-y-1.5 p-2">
              {b.opportunities.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">—</p>
              ) : (
                b.opportunities.map((o) => (
                  <div key={o.id} className="rounded-md border bg-card px-2.5 py-2 shadow-card">
                    <p className="truncate text-xs font-medium">{o.name}</p>
                    {o.monetaryValue ? (
                      <p className="text-[11px] tabular-nums text-muted-foreground">{formatMoneyBR(o.monetaryValue)}</p>
                    ) : null}
                  </div>
                ))
              )}
              {b.count > b.opportunities.length ? (
                <p className="px-1 pt-1 text-[11px] text-muted-foreground">
                  +{b.count - b.opportunities.length} mais
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
