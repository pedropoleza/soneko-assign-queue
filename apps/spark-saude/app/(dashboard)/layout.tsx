import { TopTabs } from "@/components/shell/top-tabs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">Spark Saúde</span>
            <span className="text-sm text-muted-foreground">Dashboard da Corretora</span>
          </div>
          <span className="text-sm text-muted-foreground">Seguro Saúde</span>
        </div>
        <div className="mx-auto max-w-[1400px] px-6">
          <TopTabs />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
    </div>
  );
}
