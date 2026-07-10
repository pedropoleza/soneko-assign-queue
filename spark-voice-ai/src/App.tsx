import { useState } from 'react';
import { Mic } from 'lucide-react';
import { Topbar, type TabId } from '@/components/Topbar';
import { Dashboard } from '@/pages/Dashboard';
import { MyVoicePage } from '@/pages/MyVoicePage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { TestAudioPage } from '@/pages/TestAudioPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { UsagePage } from '@/pages/UsagePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useAppState } from '@/hooks/useAppState';
import { getSession } from '@/lib/config';

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const { state, error, isLoading } = useAppState();
  const hasSession = !!getSession();

  // Sem sessão: convida a instalar/conectar via OAuth do GHL (D1).
  if (!hasSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
        <div className="card max-w-md p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white">
            <Mic size={22} />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-ink-900">Spark Voice AI</h1>
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
      <div className="min-h-screen bg-ink-50">
        <div className="h-14 border-b border-ink-200 bg-white" />
        <main className="mx-auto max-w-screen-2xl px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card h-24 animate-pulse" />
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
          <div className="text-sm font-medium text-ink-900">Não foi possível carregar o painel</div>
          <div className="mt-1 text-xs text-ink-500">{error ?? 'erro desconhecido'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <Topbar companyName={state.account.company_name} activeTab={tab} onTabChange={setTab} />
      <main className="mx-auto max-w-screen-2xl px-6 py-6">
        {tab === 'dashboard' && <Dashboard state={state} />}
        {tab === 'voice' && <MyVoicePage />}
        {tab === 'templates' && <TemplatesPage />}
        {tab === 'test' && <TestAudioPage />}
        {tab === 'history' && <HistoryPage />}
        {tab === 'usage' && <UsagePage state={state} />}
        {tab === 'settings' && <SettingsPage state={state} />}
      </main>
    </div>
  );
}
