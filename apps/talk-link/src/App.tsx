import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { getSecret, requestSsoSecret, saveSecret } from '@/lib/config';
import type { AppState, Link } from '@/types';
import { Topbar, type TabId } from '@/components/Topbar';
import { CampaignForm } from '@/components/CampaignForm';
import { LinkResult } from '@/components/LinkResult';
import { LinksPanel, RecentSends } from '@/components/LinksPanel';
import { PartnersPanel } from '@/components/PartnersPanel';
import { MetricsPanel } from '@/components/MetricsPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { LinkDetailDrawer } from '@/components/LinkDetailDrawer';
import { Button, Card, Field, Input, Skeleton } from '@/components/ui';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabId>('builder');
  const [lastCreated, setLastCreated] = useState<Link | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.state(30);
      setState(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Sem segredo salvo, tentamos o SSO do GHL antes de pedir para o usuário.
      if (!getSecret()) await requestSsoSecret();
      if (getSecret()) await load();
      setBooting(false);
    })();
  }, [load]);

  // Os envios chegam por webhook; um refresh periódico mantém o painel vivo.
  useEffect(() => {
    if (!state) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [state, load]);

  if (booting) {
    return (
      <div className="min-h-screen bg-ink-50">
        <div className="h-14 border-b border-ink-200 bg-white" />
        <main className="mx-auto max-w-screen-2xl space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-72" />
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
        <Card className="w-full max-w-md p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink-900">Talk Link</div>
              <div className="text-xs text-ink-500">Links de WhatsApp com rastreio de verdade</div>
            </div>
          </div>

          <p className="mb-4 text-xs leading-relaxed text-ink-600">
            Abra o app pelo menu do GoHighLevel para entrar automaticamente. Se você tem uma chave de acesso,
            pode colar abaixo.
          </p>

          <Field label="Chave de acesso">
            <Input
              value={manualSecret}
              onChange={(e) => setManualSecret(e.target.value)}
              placeholder="cole a chave da sua conta"
              type="password"
            />
          </Field>

          <Button
            className="mt-4 w-full"
            disabled={manualSecret.trim().length < 10}
            onClick={() => {
              saveSecret(manualSecret.trim());
              window.location.reload();
            }}
          >
            Entrar
          </Button>

          {error && error !== 'missing_secret' && (
            <p className="mt-3 text-center text-[11px] text-rose-600">{error}</p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <Topbar
        locationName={state.account.name}
        activeTab={tab}
        onTabChange={setTab}
        isLive={!error}
        isRefreshing={refreshing}
      />

      <main className="mx-auto max-w-screen-2xl px-4 py-6 pb-24 sm:px-6">
        {tab === 'builder' && (
          <>
            <div className="mb-5">
              <h1 className="text-lg font-semibold tracking-tight text-ink-900">Gerador de links</h1>
              <p className="mt-0.5 text-sm text-ink-500">
                Crie links de WhatsApp por influenciador e acompanhe cliques e mensagens realmente enviadas.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              <CampaignForm
                state={state}
                onCreated={(link) => {
                  setLastCreated(link);
                  load();
                }}
              />
              <div className="space-y-5">
                {lastCreated ? (
                  <LinkResult link={lastCreated} onOpenDetail={setDetailId} />
                ) : (
                  <Card className="p-6 text-center">
                    <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-medium text-ink-800">Nenhum link gerado ainda</div>
                    <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-500">
                      Preencha o formulário ao lado. O link aparece aqui pronto para copiar e colar.
                    </p>
                  </Card>
                )}
                <RecentSends state={state} />
              </div>
            </div>
          </>
        )}

        {tab === 'links' && (
          <div className="space-y-5">
            <LinksPanel state={state} onRefresh={load} onOpenDetail={setDetailId} />
          </div>
        )}

        {tab === 'partners' && <PartnersPanel state={state} onRefresh={load} />}

        {tab === 'metrics' && <MetricsPanel state={state} />}

        {tab === 'settings' && <SettingsPanel state={state} onRefresh={load} />}
      </main>

      <button
        onClick={load}
        title="Atualizar"
        className="fixed bottom-5 right-5 z-20 grid h-10 w-10 place-items-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-lg transition-colors hover:text-brand-700"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
      </button>

      <LinkDetailDrawer linkId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
