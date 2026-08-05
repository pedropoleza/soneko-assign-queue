import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { getSecret, requestSsoSecret, saveSecret } from '@/lib/config';
import type { AppState, Link } from '@/types';
import { Topbar, type TabId } from '@/components/Topbar';
import { CreatePage } from '@/components/CreatePage';
import { LinkReady } from '@/components/LinkReady';
import { ResultsPage } from '@/components/ResultsPage';
import { LinkDetailDrawer } from '@/components/LinkDetailDrawer';
import { PartnerDrawer } from '@/components/PartnerDrawer';
import { Button, Input, Skeleton } from '@/components/ui';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabId>('create');
  const [created, setCreated] = useState<Link | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState('');
  const [days, setDays] = useState(30);

  const load = useCallback(async (window = days) => {
    setRefreshing(true);
    try {
      setState(await api.state(window));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [days]);

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
    const id = setInterval(() => load(), 60_000);
    return () => clearInterval(id);
  }, [state, load]);

  if (booting) {
    return (
      <div className="min-h-screen bg-paper">
        <div className="h-12 border-b border-line bg-surface" />
        <main className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
          <Skeleton className="h-[480px] w-full" />
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-4">
        <div className="card w-full max-w-sm p-7">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Entrar</h1>
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

        {tab === 'results' && (
          <ResultsPage
            state={state}
            days={days}
            onChangeDays={(d) => {
              setDays(d);
              load(d);
            }}
            onRefresh={() => load()}
            onOpenLink={setLinkId}
            onOpenPartner={setPartnerId}
          />
        )}
      </main>

      <PartnerDrawer
        partnerId={partnerId}
        onClose={() => setPartnerId(null)}
        onOpenLink={(id) => {
          setPartnerId(null);
          setLinkId(id);
        }}
      />
      <LinkDetailDrawer linkId={linkId} onClose={() => setLinkId(null)} />
    </div>
  );
}
