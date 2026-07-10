import { useState } from 'react';
import { Topbar, type TabId } from '@/components/Topbar';
import { Dashboard } from '@/pages/Dashboard';
import { VoiceStudioPage } from '@/pages/VoiceStudioPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { UsagePage } from '@/pages/UsagePage';
import { BillingPage } from '@/pages/BillingPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useAppState } from '@/hooks/useAppState';

// UI autenticada (sessão já resolvida pelo App).
export function Panel() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const { state, error, isLoading } = useAppState();

  if (isLoading && !state) {
    return (
      <div className="min-h-screen">
        <div className="h-[60px] border-b border-ink-200 bg-white" />
        <main className="wrap py-7">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card h-28 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
        <div className="card max-w-md p-6 text-center">
          <div className="text-sm font-semibold text-ink-900">Não foi possível carregar o painel</div>
          <div className="mt-1 text-xs text-ink-500">{error ?? 'erro desconhecido'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar activeTab={tab} onTabChange={setTab} />
      <main className="wrap py-7">
        {tab === 'dashboard' && <Dashboard state={state} />}
        {tab === 'voice' && <VoiceStudioPage state={state} />}
        {tab === 'templates' && <TemplatesPage />}
        {tab === 'history' && <HistoryPage />}
        {tab === 'usage' && <UsagePage state={state} />}
        {tab === 'billing' && <BillingPage />}
        {tab === 'settings' && <SettingsPage state={state} />}
      </main>
    </div>
  );
}
