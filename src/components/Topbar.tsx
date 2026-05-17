import { CircleDot, Webhook } from 'lucide-react';
import { Badge } from './ui/Badge';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'dashboard', label: 'Painel' },
  { id: 'assignments', label: 'Atribuições' },
  { id: 'reps', label: 'Vendedores' },
  { id: 'settings', label: 'Configurações' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export function Topbar({
  locationName,
  ghlLocationId,
  activeTab,
  onTabChange,
  isLive,
}: {
  locationName: string;
  ghlLocationId: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isLive: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Webhook className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-ink-900">Soneko Assign Queue</div>
              <div className="text-[11px] text-ink-500">Distribuição round-robin de leads</div>
            </div>
          </div>
          <Badge tone="brand" className="ml-2">
            <CircleDot className="h-3 w-3" />
            {locationName}
            <span className="ml-1 font-mono text-[10px] text-brand-500">{ghlLocationId.slice(0, 8)}…</span>
          </Badge>
        </div>

        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={cn(
                'relative h-9 rounded-md px-3 text-sm font-medium transition-colors',
                activeTab === t.id
                  ? 'text-brand-700 bg-brand-50'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-ink-100',
              )}
            >
              {t.label}
              {activeTab === t.id && (
                <span className="absolute inset-x-3 -bottom-[14px] h-0.5 rounded-full bg-brand-600" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
              isLive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />
            {isLive ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
