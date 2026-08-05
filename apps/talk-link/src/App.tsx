import { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { getSecret, requestSsoSecret, saveSecret } from '@/lib/config';
import type { AppState, Link } from '@/types';
import { Topbar, type TabId } from '@/components/Topbar';
import { CreatePage } from '@/components/CreatePage';
import { LinkReady } from '@/components/LinkReady';
import { ResultsPage } from '@/components/ResultsPage';
import { SettingsPage } from '@/components/SettingsPage';
import { LinkDetailDrawer } from '@/components/LinkDetailDrawer';
import { Button, Input, Skeleton } from '@/components/ui';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabId>('create');
  const [created, setCreated] = useState<Link | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setState(await api.state(30));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!getSecret()) await requestSsoSecret();
      if (getSecret()) await load();
      setBooting(false);
    })();
  }, [load]);

  // Os envios chegam por webhook, então o painel se atualiza sozinho.
  useEffect(() => {
    if (!state) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [state, load]);

  if (booting) {
    return (
      <div className="min-h-screen bg-paper">
        <div className="h-16 border-b border-line" />
        <main className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
          <Skeleton className="h-11 w-56" />
          <Skeleton className="h-[420px] w-full" />
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-4">
        <div className="surface w-full max-w-sm p-7 shadow-lift">
          <span className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-btn text-btn-ink">
            <MessageCircle className="h-5 w-5" />
          </span>
          <h1 className="font-display text-xl font-semibold text-ink">Talk Link</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
            Abra pelo menu do seu CRM para entrar direto. Se você recebeu uma chave de acesso, cole aqui.
          </p>

          <Input
            className="mt-5"
            type="password"
            value={manualSecret}
            onChange={(e) => setManualSecret(e.target.value)}
            placeholder="Chave de acesso"
          />
          <Button
            className="mt-3 w-full"
            disabled={manualSecret.trim().length < 10}
            onClick={() => {
              saveSecret(manualSecret.trim());
              window.location.reload();
            }}
          >
            Entrar
          </Button>

          {error && error !== 'missing_secret' && (
            <p className="mt-4 text-center text-[12px] text-danger">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Topbar
        accountName={state.account.name}
        activeTab={tab}
        onTabChange={(t) => {
          setTab(t);
          if (t !== 'create') setCreated(null);
        }}
        isRefreshing={refreshing}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 pb-20 sm:px-6">
        {tab === 'create' &&
          (created ? (
            <LinkReady
              link={created}
              businessName={state.account.name}
              onNew={() => setCreated(null)}
              onSeeResults={() => {
                setCreated(null);
                setTab('results');
              }}
            />
          ) : (
            <CreatePage
              state={state}
              onCreated={(link) => {
                setCreated(link);
                load();
              }}
            />
          ))}

        {tab === 'results' && <ResultsPage state={state} onRefresh={load} onOpenLink={setDetailId} />}

        {tab === 'settings' && <SettingsPage state={state} onRefresh={load} />}
      </main>

      <LinkDetailDrawer linkId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
