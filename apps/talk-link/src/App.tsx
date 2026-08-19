import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { clearSecret, getLocationId, getSecret, requestSsoSecret, saveSecret, type SsoResult } from '@/lib/config';
import type { AppState, Link } from '@/types';
import { Topbar, type TabId } from '@/components/Topbar';
import { CreatePage } from '@/components/CreatePage';
import { LinkReady } from '@/components/LinkReady';
import { ResultsPage } from '@/components/ResultsPage';
import { LinkDetailDrawer } from '@/components/LinkDetailDrawer';
import { PartnerDrawer } from '@/components/PartnerDrawer';
import { Button, Input, Skeleton } from '@/components/ui';

/** O que dizer quando o SSO não entregou a chave. Cada motivo tem uma saída. */
const SSO_HINT: Record<string, string> = {
  sem_iframe:
    'Esta página foi aberta fora do CRM. Abra pelo menu do GoHighLevel, ou cole a chave de acesso abaixo.',
  sem_resposta:
    'O CRM não respondeu ao pedido de identificação. Isso acontece em Custom Menu Link comum — a entrada automática só funciona na Custom Page do app. Use o link com a chave, ou configure a Custom Page.',
  chave_errada:
    'Não consegui decifrar os dados do usuário: a chave de SSO cadastrada não confere com a do app. Cole a chave de acesso abaixo enquanto isso é corrigido.',
  nao_instalado:
    'O app ainda não está instalado nesta sub-conta. Instale por ela e abra de novo.',
  sso_desligado: 'O SSO ainda não foi configurado no servidor.',
  erro: 'Não consegui identificar a sub-conta automaticamente. Cole a chave de acesso abaixo.',
};

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
  const [sso, setSso] = useState<SsoResult | null>(null);

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
      const inIframe = typeof window !== 'undefined' && window.parent !== window;
      const wanted = getLocationId();

      // Custom Page (dentro do iframe, sem location_id na URL): o SSO é a única
      // fonte que sabe QUAL sub-conta o CRM está exibindo agora. A chave em cache
      // é só atalho e pode ter ficado de outra sub-conta — quem administra várias
      // troca de cliente na mesma aba. Então perguntamos ao CRM, e a resposta
      // dele (que requestSsoSecret grava por cima do cache) vence o atalho.
      // Sem isso, a location da Freguglia abria mostrando a Nathalia Lucca.
      if (inIframe && !wanted) {
        const res = await requestSsoSecret();
        if (!('secret' in res)) setSso(res);
      } else if (!getSecret()) {
        setSso(await requestSsoSecret());
      }

      if (getSecret()) {
        const data = await api.state(30).catch(() => null);

        // Custom Menu Link: a própria URL nomeia a sub-conta. Se a chave guardada
        // é de outra, descarta e refaz o SSO.
        if (data && wanted && data.account.ghl_location_id !== wanted) {
          clearSecret();
          const again = await requestSsoSecret();
          setSso(again);
          if ('secret' in again) await load();
        } else if (data) {
          setState(data);
          setError(null);
        } else {
          await load();
        }
      }
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
        <main className="mx-auto max-w-[1440px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="h-[480px] w-full" />
        </main>
      </div>
    );
  }

  if (!state) {
    const reason = sso && 'reason' in sso ? sso.reason : 'erro';
    const locationId = getLocationId();
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-4">
        <div className="card w-full max-w-sm p-7">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Entrar</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{SSO_HINT[reason]}</p>

          {locationId && (
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11px] text-ink-3">
              sub-conta {locationId}
            </p>
          )}

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

      <main className="mx-auto max-w-[1440px] px-4 py-6 pb-16 sm:px-6 lg:px-8">
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
