import { CircleDot, Menu, Webhook } from 'lucide-react';
import { useState } from 'react';
import { Badge } from './ui/Badge';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'dashboard', label: 'Painel' },
  { id: 'assignments', label: 'Atribuições' },
  { id: 'reps', label: 'Vendedores' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export function Topbar({
  locationName,
  ghlLocationId,
  activeTab,
  onTabChange,
  isLive,
  isRefreshing = false,
}: {
  locationName: string;
  ghlLocationId: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
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
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Webhook className="h-4 w-4" />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold text-ink-900">Soneko Assign Queue</div>
              <div className="text-[11px] text-ink-500">Distribuição round-robin de leads</div>
            </div>
          </div>
          <Badge tone="brand" className="hidden sm:inline-flex">
            <CircleDot className="h-3 w-3" />
            {locationName}
            <span className="ml-1 font-mono text-[10px] text-brand-500">{ghlLocationId.slice(0, 8)}…</span>
          </Badge>
        </div>

        {/* Desktop tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={cn(
                'relative h-9 rounded-md px-3 text-sm font-medium transition-colors',
                activeTab === t.id ? 'text-brand-700 bg-brand-50' : 'text-ink-600 hover:text-ink-900 hover:bg-ink-100',
              )}
            >
              {t.label}
              {activeTab === t.id && (
                <span className="absolute inset-x-3 -bottom-[14px] h-0.5 rounded-full bg-brand-600" />
              )}
            </button>
          ))}
        </nav>

        {/* Mobile menu */}
        <div className="md:hidden relative">
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
              <div className="absolute right-0 mt-2 w-44 z-20 rounded-md border border-ink-200 bg-white shadow-lg p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { onTabChange(t.id); setMobileOpen(false); }}
                    className={cn(
                      'block w-full rounded text-left px-3 py-2 text-sm transition-colors',
                      activeTab === t.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-700 hover:bg-ink-100',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 sm:px-2.5 py-1 text-[11px] font-medium',
              isLive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />
            <span className="hidden sm:inline">{isLive ? 'Online' : 'Offline'}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
