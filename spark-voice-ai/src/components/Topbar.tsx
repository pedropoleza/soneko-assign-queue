import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabId =
  | 'dashboard'
  | 'voice'
  | 'templates'
  | 'test'
  | 'history'
  | 'usage'
  | 'settings';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'voice', label: 'My Voice' },
  { id: 'templates', label: 'Templates' },
  { id: 'test', label: 'Generate Test Audio' },
  { id: 'history', label: 'Audio History' },
  { id: 'usage', label: 'Usage' },
  { id: 'settings', label: 'Settings' },
];

export function Topbar({
  companyName,
  activeTab,
  onTabChange,
}: {
  companyName: string;
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-6 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Mic size={16} />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink-900">Spark Voice AI</div>
            <div className="text-[11px] text-ink-500">{companyName}</div>
          </div>
        </div>
        <nav className="ml-4 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === t.id ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
