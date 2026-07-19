"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/page-header";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/data-state";

export default function PipelinePage() {
  const q = useQuery({ queryKey: ["pipeline"], queryFn: api.pipeline });

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Os dois funis do fluxo de saúde — Aquisição e Cliente — com contagem por etapa."
      />

      {q.isLoading ? (
        <div className="space-y-8">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Skeleton key={k} className="h-40 w-64 shrink-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState title="Nenhuma pipeline encontrada" hint="Verifique as pipelines configuradas nesta location do GHL." />
      ) : (
        <div className="space-y-8">
          {q.data.map((view) => (
            <PipelineBoard key={view.pipeline.id} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}
