"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Ao vivo" indicator + manual refresh. Signals that the dashboard mirrors the
 * GHL subaccount in real time (server routes are force-dynamic / no-store and
 * the queries poll), and lets Dani force a pull on demand. The relative
 * timestamp is computed on a ticking clock so it stays honest while open.
 */
export function LiveStatus({
  updatedAt,
  fetching,
  onRefresh,
}: {
  updatedAt?: number;
  fetching?: boolean;
  onRefresh: () => void;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const ago = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  const agoLabel =
    ago == null ? "" : ago < 45 ? "agora" : ago < 3600 ? `há ${Math.round(ago / 60)} min` : `há ${Math.round(ago / 3600)} h`;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border bg-white/70 px-2 py-1 shadow-card backdrop-blur">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[rgba(18,183,106,0.55)]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#12B76A]" />
      </span>
      <span className="text-xs font-medium text-foreground">Ao vivo</span>
      {agoLabel ? <span className="hidden text-xs text-muted-foreground sm:inline">· {agoLabel}</span> : null}
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Atualizar agora"
        title="Atualizar agora"
        className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
      </button>
    </div>
  );
}
