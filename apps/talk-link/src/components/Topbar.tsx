import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TABS = [
  { id: 'create', label: 'Criar link' },
  { id: 'results', label: 'Resultados' },
  { id: 'settings', label: 'Ajustes' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export function Topbar({
  accountName,
  activeTab,
  onTabChange,
  isRefreshing = false,
}: {
  accountName: string;
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
  isRefreshing?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      {isRefreshing && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/4 animate-[bar_1.4s_ease-in-out_infinite] bg-accent" />
        </div>
      )}

      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-btn text-btn-ink">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-ink">Talk&nbsp;Link</span>
        </div>

        {/* Segmentado: três destinos, sempre visíveis, sem menu escondido no mobile. */}
        <nav className="ml-auto flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition sm:px-3.5',
                activeTab === t.id
                  ? 'bg-accent-soft text-accent-deep'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <span className="hidden max-w-[160px] truncate text-[12px] text-ink-3 lg:block">{accountName}</span>
      </div>
    </header>
  );
}
