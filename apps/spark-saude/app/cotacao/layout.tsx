import Link from "next/link";
import { LEAO_BRAND } from "@/lib/cotacao/brand";

/**
 * Cotação Leão runs as its OWN product, not a tab of the Spark Saúde dashboard.
 * It gets its own Custom Menu Link in GHL and its own shell here — the broker
 * opens "Cotação" to quote and "Dashboard" to manage the book; mixing the two
 * put a build-a-quote workspace inside a reporting surface.
 *
 * Same iframe rule as the dashboard: the shell pins to the viewport and
 * scrolling happens inside, so the embedded frame never double-scrolls.
 * `--shell-chrome` = header (3rem) + main's vertical padding (2 × 1.25rem).
 */
export default function CotacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ ["--shell-chrome" as string]: "5.5rem" }}>
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-12 w-full max-w-[1800px] items-center gap-3 px-5">
          <span className="text-sm font-semibold tracking-tight" style={{ color: LEAO_BRAND.primary }}>
            Cotação
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">Marketplace · {LEAO_BRAND.name}</span>
          <Link
            href="/overview"
            className="ml-auto text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ir para o dashboard →
          </Link>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1800px] px-5 py-5">{children}</div>
      </main>
    </div>
  );
}
