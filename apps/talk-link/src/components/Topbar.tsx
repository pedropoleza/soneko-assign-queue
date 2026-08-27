import { cn } from '@/lib/utils';

export const TABS = [
  { id: 'create', label: 'Criar link' },
  { id: 'results', label: 'Resultados' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

/**
 * Só as abas. Nome do produto, logo e status de conexão saíram: o app abre
 * dentro do CRM, que já diz onde a pessoa está — repetir isso só rouba altura.
 */
export function Topbar({
  activeTab,
  onTabChange,
  isRefreshing = false,
}: {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
  isRefreshing?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
      {isRefreshing && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/4 animate-[bar_1.4s_ease-in-out_infinite] bg-accent/60" />
        </div>
      )}

      <nav className="mx-auto flex h-12 max-w-[1440px] items-center gap-1 px-4 sm:px-6 lg:px-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
            className={cn(
              'relative h-12 px-1 text-sm font-medium transition-colors',
              'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors',
              activeTab === t.id
                ? 'text-ink after:bg-accent'
                : 'text-ink-3 after:bg-transparent hover:text-ink-2',
            )}
          >
            <span className="px-2">{t.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
