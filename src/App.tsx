import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Topbar, type TabId } from '@/components/Topbar';
import { SecretGate } from '@/components/SecretGate';
import { Dashboard } from '@/pages/Dashboard';
import { AssignmentsPage } from '@/pages/AssignmentsPage';
import { RepsPage } from '@/pages/RepsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { api, ApiError } from '@/lib/api';
import { getSecret } from '@/lib/config';
import type { AppState } from '@/types';

const REFRESH_INTERVAL_MS = 12_000;

export default function App() {
  const [hasSecret, setHasSecret] = useState<boolean>(() => !!getSecret());
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getState();
      setState(data);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.message === 'invalid_secret')) {
        setHasSecret(false);
        setError('Secret inválido — entre novamente.');
      } else {
        setError((e as Error).message);
        toast.error(`Falha ao carregar: ${(e as Error).message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSecret) return;
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasSecret, load]);

  const isLive = useMemo(() => !error && !!state, [error, state]);

  if (!hasSecret) {
    return <SecretGate onAuthed={() => { setHasSecret(true); setIsLoading(true); }} />;
  }

  if (isLoading && !state) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-50">
        <div className="flex items-center gap-2 text-ink-500">
          <span className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          Carregando painel...
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
        <div className="card p-6 text-center max-w-md">
          <div className="text-sm font-medium text-ink-900">Não foi possível carregar o painel</div>
          <div className="mt-1 text-xs text-ink-500">{error ?? 'erro desconhecido'}</div>
          <button
            onClick={load}
            className="mt-4 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <Topbar
        locationName={state.location.name}
        ghlLocationId={state.location.ghl_location_id}
        activeTab={tab}
        onTabChange={setTab}
        isLive={isLive}
      />
      <main className="mx-auto max-w-screen-2xl px-6 py-6">
        {tab === 'dashboard' && <Dashboard state={state} refresh={load} />}
        {tab === 'assignments' && <AssignmentsPage state={state} refresh={load} />}
        {tab === 'reps' && <RepsPage state={state} refresh={load} />}
        {tab === 'settings' && <SettingsPage state={state} />}
      </main>
    </div>
  );
}
