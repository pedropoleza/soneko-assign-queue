import { useState } from 'react';
import { Menu, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TABS = [
  { id: 'builder', label: 'Gerar link' },
  { id: 'links', label: 'Links' },
  { id: 'partners', label: 'Parceiros' },
  { id: 'metrics', label: 'Métricas' },
  { id: 'settings', label: 'Ajustes' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export function Topbar({
  locationName,
  activeTab,
  onTabChange,
  isLive,
  isRefreshing = false,
}: {
  locationName: string;
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
  isLive: boolean;
  isRefreshing?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = TABS.find((t) => t.id === activeTab)?.label;

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
      {isRefreshing && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] bg-brand-500" />
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white">
              <MessageCircle className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink-900">Talk Link</span>
          </div>
          <span className="hidden truncate text-xs text-ink-400 lg:inline">· {locationName}</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={cn(
                'relative h-9 rounded-md px-3 text-sm font-medium transition-colors',
                activeTab === t.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
              )}
            >
              {t.label}
              {activeTab === t.id && (
                <span className="absolute inset-x-3 -bottom-[14px] h-0.5 rounded-full bg-brand-600" />
              )}
            </button>
          ))}
        </nav>

        <div className="relative md:hidden">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Menu className="h-3.5 w-3.5" />
            {activeLabel}
          </button>
          {mobileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMobileOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-ink-200 bg-white p-1 shadow-lg">
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
                        ? 'bg-brand-50 font-medium text-brand-700'
                        : 'text-ink-700 hover:bg-ink-100',
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
          <span className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />
          <span className="hidden sm:inline">{isLive ? 'Online' : 'Offline'}</span>
        </span>
      </div>
    </header>
  );
}
