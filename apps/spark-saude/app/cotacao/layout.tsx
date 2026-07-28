import { Shield } from "lucide-react";
import { LEAO_BRAND } from "@/lib/cotacao/brand";

/**
 * Cotação Leão is a standalone product, not a section of the Spark Saúde
 * dashboard: its own URL, its own GHL menu link, and deliberately NO navigation
 * back to the dashboard.
 *
 * The header is a light bar with a thin gradient thread — the navy slab was
 * heavy and made the working screen feel like a landing page. Color now lives
 * in the product itself (vivid blue actions, metal-tier cards); the top stays
 * quiet so the content leads.
 *
 * `.leao` swaps the design tokens for this subtree; the dashboard keeps the
 * GoHighLevel look. Full-bleed, and the shell pins to the viewport so the
 * embedded frame never double-scrolls.
 */
export default function CotacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="leao flex h-[100dvh] flex-col overflow-hidden bg-page"
      style={{ ["--shell-chrome" as string]: "5.9rem" }}
    >
      <header className="shrink-0 bg-background/90 backdrop-blur">
        {/* Fio da marca — azul → navy → dourado */}
        <span
          className="block h-[3px] w-full"
          style={{ background: "linear-gradient(90deg, #2563EB 0%, #1B2A4A 55%, #C9962E 100%)" }}
          aria-hidden
        />
        <div className="flex h-[53px] w-full items-center gap-3 border-b px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-semibold tracking-tight" style={{ color: LEAO_BRAND.primary }}>
              {LEAO_BRAND.name}
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{LEAO_BRAND.tagline}</p>
          </div>
          <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-primary">
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
