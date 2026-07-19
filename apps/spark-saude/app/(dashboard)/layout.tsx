import { TopTabs } from "@/components/shell/top-tabs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-4 px-6">
          <span className="shrink-0 text-sm font-semibold tracking-tight">Spark Saúde</span>
          <span className="hidden h-5 w-px shrink-0 bg-border sm:block" />
          <TopTabs className="min-w-0 flex-1 overflow-x-auto" />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
    </div>
  );
}
