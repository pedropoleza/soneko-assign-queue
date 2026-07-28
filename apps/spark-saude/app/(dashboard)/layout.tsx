import { TopTabs } from "@/components/shell/top-tabs";

/**
 * App shell. The dashboard is embedded in GoHighLevel through an iframe, so the
 * document itself must NEVER grow taller than the frame — otherwise the parent
 * page and the frame both scroll and the user fights two scrollbars (and GHL
 * gives the iframe a fixed height, so a tall document just gets clipped).
 *
 * The shell therefore pins itself to the viewport (`100dvh`) and scrolling
 * happens INSIDE `main`. Pages that want to own the full height without any
 * scrolling of their own (the quote cockpit) size themselves against
 * `--shell-chrome` = header (3rem) + main's vertical padding (2 × 1.25rem).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ ["--shell-chrome" as string]: "5.5rem" }}>
      {/* Tabs only — the app is embedded inside GHL, which already provides the
          product chrome; repeating a brand label here is noise. */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-12 w-full max-w-[1800px] items-center px-5">
          <TopTabs className="min-w-0 flex-1 overflow-x-auto" />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1800px] px-5 py-5">{children}</div>
      </main>
    </div>
  );
}
