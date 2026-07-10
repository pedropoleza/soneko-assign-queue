import { useState } from 'react';
import { Mic } from 'lucide-react';
import { Topbar, type TabId } from '@/components/Topbar';
import { Dashboard } from '@/pages/Dashboard';
import { VoiceStudioPage } from '@/pages/VoiceStudioPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { UsagePage } from '@/pages/UsagePage';
import { BillingPage } from '@/pages/BillingPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useAppState } from '@/hooks/useAppState';
import { getSession } from '@/lib/config';

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const { state, error, isLoading } = useAppState();
  const hasSession = !!getSession();

  if (!hasSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
        <div className="card max-w-md p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Mic size={22} />
          </span>
          <h1 className="mt-4 text-lg font-bold text-ink-900">Spark Voice AI</h1>
          <p className="mt-1 text-sm text-ink-500">
            Conecte sua conta do GoHighLevel para começar a gerar áudios personalizados com voz clonada.
          </p>
          <a className="btn-primary mt-5 w-full" href="/functions/v1/spark-oauth/install">
            Conectar com GoHighLevel
          </a>
        </div>
      </div>
    );
  }

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
