import {
  LayoutDashboard,
  Mic,
  FileText,
  History,
  BarChart3,
  CreditCard,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabId =
  | 'dashboard'
  | 'voice'
  | 'templates'
  | 'history'
  | 'usage'
  | 'billing'
  | 'settings';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { id: 'voice', label: 'Voice Studio', icon: <Mic size={16} /> },
  { id: 'templates', label: 'Templates', icon: <FileText size={16} /> },
  { id: 'history', label: 'Audio History', icon: <History size={16} /> },
  { id: 'usage', label: 'Usage', icon: <BarChart3 size={16} /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
];

export function Topbar({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (t: TabId) => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/85 backdrop-blur">
      <div className="wrap flex h-[60px] items-center gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={cn(
              'relative flex h-[60px] items-center gap-2 whitespace-nowrap px-4 text-sm font-semibold transition-colors',
              activeTab === t.id ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            <span className="opacity-80">{t.icon}</span>
            {t.label}
            {activeTab === t.id && (
              <span className="absolute inset-x-2.5 -bottom-px h-[2.5px] rounded bg-brand-600" />
            )}
          </button>
        ))}
      </div>
    </header>
  );
}
