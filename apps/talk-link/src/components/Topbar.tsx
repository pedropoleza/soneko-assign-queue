import { useState } from 'react';
import { CircleDot, Menu, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TABS = [
  { id: 'create', label: 'Criar link' },
  { id: 'results', label: 'Resultados' },
  { id: 'settings', label: 'Ajustes' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

/**
 * Mesmo cabeçalho dos outros painéis de iframe do GHL: abas com sublinhado,
 * identificação da conta à esquerda e o indicador de conexão à direita.
 */
export function Topbar({
  accountName,
  activeTab,
  onTabChange,
  isLive,
  isRefreshing = false,
}: {
  accountName: string;
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
  isLive: boolean;
  isRefreshing?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = TABS.find((t) => t.id === activeTab)?.label;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      {isRefreshing && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[bar_1.4s_ease-in-out_infinite] bg-accent" />
        </div>
      )}

      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white">
              <MessageCircle className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">Talk Link</span>
          </div>
          <span className="pill-brand hidden lg:inline-flex">
            <CircleDot className="h-3 w-3" />
            <span className="max-w-[180px] truncate">{accountName}</span>
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
              className={cn(
                'relative h-9 rounded-md px-3 text-sm font-medium transition-colors',
                activeTab === t.id
                  ? 'bg-accent-soft text-accent-deep'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {t.label}
              {activeTab === t.id && (
                <span className="absolute inset-x-3 -bottom-[14px] h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </nav>

        <div className="relative md:hidden">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2"
          >
            <Menu className="h-3.5 w-3.5" />
            {activeLabel}
          </button>
          {mobileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMobileOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-line bg-surface p-1 shadow-lg">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onTabChange(t.id);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      'block w-full rounded px-3 py-2 text-left text-sm transition-colors',
                      activeTab === t.id
                        ? 'bg-accent-soft font-medium text-accent-deep'
                        : 'text-ink-2 hover:bg-surface-2',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium sm:px-2.5',
            isLive
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'animate-pulse bg-emerald-500' : 'bg-rose-500')} />
          <span className="hidden sm:inline">{isLive ? 'Online' : 'Offline'}</span>
        </span>
      </div>
    </header>
  );
}
