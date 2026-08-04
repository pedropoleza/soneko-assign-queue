/**
 * Cotação — standalone app embedded in GHL via its own Custom Menu Link.
 *
 * The shell follows the same logic as every app we ship inside GoHighLevel
 * (CLAUDE.md §6): GHL already provides the product chrome around the iframe,
 * so repeating a brand bar here is noise. A slim plain-text bar names the
 * screen and nothing else; the brokerage brand appears only on the material
 * the CLIENT receives (/proposta).
 *
 * Full-bleed, pinned to the viewport so the embedded frame never
 * double-scrolls: scrolling happens inside <main>.
 */
export default function CotacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-page" style={{ ["--shell-chrome" as string]: "5.5rem" }}>
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-12 w-full items-center gap-2 px-5">
          <span className="text-sm font-semibold tracking-tight">Cotação</span>
          <span className="text-sm text-muted-foreground">· Marketplace</span>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-5 py-5">{children}</div>
      </main>
    </div>
  );
}
