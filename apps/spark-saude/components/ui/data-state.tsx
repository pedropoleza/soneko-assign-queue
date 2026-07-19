import { Skeleton } from "./skeleton";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function LoadingRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background px-6 py-12 text-center">
      <p className="text-sm font-medium text-status-red-fg">Não foi possível carregar</p>
      <p className="max-w-md text-sm text-muted-foreground">{message || "Ocorreu um erro ao falar com o GHL."}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-background px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-md text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
