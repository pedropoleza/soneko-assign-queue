/**
 * Cotação — standalone app embedded in GHL via its own Custom Menu Link.
 *
 * The frame's height is decided by GHL and can't be resized from inside
 * (cross-origin), so every pixel of chrome we add is working area taken from
 * the broker. GHL already labels the page around the iframe and the screen
 * carries its own H1, so there is NO app bar here: the content starts at the
 * top edge. The brokerage brand appears only on what the CLIENT receives
 * (/proposta).
 *
 * Full-bleed and pinned to the frame so it never double-scrolls: scrolling
 * happens inside <main>. `--shell-chrome` (main's vertical padding) is what a
 * page must subtract to size itself against the visible frame.
 */
export default function CotacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-page" style={{ ["--shell-chrome" as string]: "2rem" }}>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-5 py-4">{children}</div>
      </main>
    </div>
  );
}
