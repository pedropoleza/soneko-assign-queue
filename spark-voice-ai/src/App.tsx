import { useState } from 'react';
import { Mic } from 'lucide-react';
import { Topbar, type TabId } from '@/components/Topbar';
import { Dashboard } from '@/pages/Dashboard';
import { Placeholder } from '@/pages/Placeholder';
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
        {tab === 'voice' && (
          <Placeholder title="My Voice" stage="Etapa 2">
            Cadastro de voz com upload de sample (Instant Voice Clone) e bloco de consentimento obrigatório.
          </Placeholder>
        )}
        {tab === 'templates' && (
          <Placeholder title="Templates" stage="Etapa 2">
            Editor de mensagem com seletor de variáveis da allow-list e preview do texto final.
          </Placeholder>
        )}
        {tab === 'test' && (
          <Placeholder title="Generate Test Audio" stage="Etapa 3">
            Seleciona template, preenche nome fictício, gera o MP3 real e ouve no player.
          </Placeholder>
        )}
        {tab === 'history' && (
          <Placeholder title="Audio History" stage="Etapa 4">
            Histórico de gerações: contato, evento, texto final, status, custo e link do áudio.
          </Placeholder>
        )}
        {tab === 'usage' && (
          <Placeholder title="Usage" stage="Etapa 4">
            Uso do mês x limite, caracteres, custo estimado, eventos e templates mais usados.
          </Placeholder>
        )}
        {tab === 'settings' && (
          <Placeholder title="Settings" stage="Etapa 4">
            Dados da conta, plano/limites, secret do webhook e URL para colar no workflow do GHL.
          </Placeholder>
        )}
      </main>
    </div>
  );
}
