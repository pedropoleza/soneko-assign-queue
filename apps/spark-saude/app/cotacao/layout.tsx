import { LEAO_BRAND } from "@/lib/cotacao/brand";

/**
 * Cotação Leão is a standalone product, not a section of the Spark Saúde
 * dashboard: its own URL, its own GHL menu link, and deliberately NO navigation
 * back to the dashboard — the two are separate tabs the broker keeps open, so a
 * cross-link here would only invite losing an in-progress quote.
 *
 * Full-bleed by design: the quote is assembled from wide plan cards, so the
 * shell spans the frame instead of a centered column. Same iframe rule as the
 * dashboard — the shell pins to the viewport and scrolling happens inside.
 */
export default function CotacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ ["--shell-chrome" as string]: "5.5rem" }}>
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-12 w-full items-center gap-3 px-6">
          <span className="text-sm font-semibold tracking-tight" style={{ color: LEAO_BRAND.primary }}>
            Cotação
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Marketplace · {LEAO_BRAND.name}
          </span>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-6 py-5">{children}</div>
      </main>
    </div>
  );
}
