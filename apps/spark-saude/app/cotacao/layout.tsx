import { Shield } from "lucide-react";
import { LEAO_BRAND } from "@/lib/cotacao/brand";

/**
 * Cotação Leão is a standalone product, not a section of the Spark Saúde
 * dashboard: its own URL, its own GHL menu link, and deliberately NO navigation
 * back to the dashboard — the two are separate tabs the broker keeps open, so a
 * cross-link here would only invite losing an in-progress quote.
 *
 * `.leao` swaps the design tokens to the brokerage's identity (docs/cotacao.md
 * §8) for this whole subtree; the dashboard keeps the GoHighLevel look.
 *
 * Full-bleed by design, and the shell pins to the viewport so the embedded
 * frame never double-scrolls.
 */
export default function CotacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="leao flex h-[100dvh] flex-col overflow-hidden bg-page"
      style={{ ["--shell-chrome" as string]: "5.75rem" }}
    >
      <header
        className="shrink-0 text-white"
        style={{ background: `linear-gradient(100deg, ${LEAO_BRAND.primaryDeep} 0%, ${LEAO_BRAND.primary} 55%, #24365C 100%)` }}
      >
        <div className="flex h-14 w-full items-center gap-3 px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
            <Shield className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-semibold tracking-tight">{LEAO_BRAND.name}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">{LEAO_BRAND.tagline}</p>
          </div>
          <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium tracking-wide text-white/80 ring-1 ring-white/10">
            Cotação · Marketplace
          </span>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
