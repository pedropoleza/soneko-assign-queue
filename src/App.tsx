import { lazy, Suspense, useState } from 'react';
import { toast } from 'sonner';
import { Topbar, type TabId } from '@/components/Topbar';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { useAppState } from '@/hooks/useAppState';
import { useShortcuts } from '@/hooks/useShortcuts';

const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const AssignmentsPage = lazy(() => import('@/pages/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })));
const RepsPage = lazy(() => import('@/pages/RepsPage').then((m) => ({ default: m.RepsPage })));
const ReportPage = lazy(() => import('@/pages/ReportPage').then((m) => ({ default: m.ReportPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));

export default function App() {
  const { state, error, isLoading, isRefreshing, refresh, mutateRep } = useAppState();
  const [tab, setTab] = useState<TabId>('dashboard');

  useShortcuts([
    { key: 'r', handler: () => refresh() },
    { key: '1', handler: () => setTab('dashboard') },
    { key: '2', handler: () => setTab('assignments') },
    { key: '3', handler: () => setTab('reps') },
    { key: '4', handler: () => setTab('report') },
    { key: '?', shift: true, handler: () => {
      toast.info('Atalhos: 1/2/3 (navegar abas) · R (recarregar) · ? (ajuda)', { duration: 6000 });
    } },
  ]);

  if (isLoading && !state) {
    return (
      <div className="min-h-screen bg-ink-50">
        <div className="h-14 border-b border-ink-200 bg-white" />
        <main className="mx-auto max-w-screen-2xl px-6 py-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </div>
          <TableSkeleton rows={6} />
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
        <div className="card p-6 text-center max-w-md">
          <div className="text-sm font-medium text-ink-900">Não foi possível carregar o painel</div>
          <div className="mt-1 text-xs text-ink-500">{error ?? 'erro desconhecido'}</div>
          <button onClick={refresh}
                  className="mt-4 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
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
        isLive={!error}
        isRefreshing={isRefreshing}
      />
      <main className="mx-auto max-w-screen-2xl px-6 py-6">
        <Suspense fallback={<TableSkeleton rows={4} />}>
          {tab === 'dashboard' && <Dashboard state={state} refresh={refresh} />}
          {tab === 'assignments' && <AssignmentsPage state={state} refresh={refresh} />}
          {tab === 'reps' && <RepsPage state={state} refresh={refresh} mutateRep={mutateRep} />}
          {tab === 'report' && <ReportPage state={state} />}
          {tab === 'notifications' && <NotificationsPage />}
        </Suspense>
      </main>
    </div>
  );
}
