import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Plus, QrCode as QrIcon, RefreshCw, Search, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { isEmbedded, ancestorAllowed } from './lib/embed';
import type { Overview, QrCode } from './types';
import { Dashboard } from './components/Dashboard';
import { QrCard } from './components/QrCard';
import { QrFormModal } from './components/QrFormModal';
import { AnalyticsModal } from './components/AnalyticsModal';

function Blocked() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-6">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-500">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink-900">Acesso restrito</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          O Spark QR só pode ser aberto de dentro do GoHighLevel. Use o menu do GHL para acessar.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  // Iframe-only: standalone access is blocked. Evaluated once at startup.
  const allowed = useMemo(() => isEmbedded() && ancestorAllowed(), []);

  const [items, setItems] = useState<QrCode[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QrCode | null>(null);
  const [analytics, setAnalytics] = useState<QrCode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, ov] = await Promise.all([api.list(), api.overview(30).catch(() => null)]);
      setItems(list);
      setOverview(ov);
    } catch {
      toast.error('Falha ao carregar. Verifique o acesso pelo GHL.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((i) =>
      i.slug.includes(q) || i.name.toLowerCase().includes(q) || i.target_url.toLowerCase().includes(q));
  }, [items, query]);

  async function toggleActive(qr: QrCode) {
    try {
      await api.update(qr.id, { is_active: !qr.is_active });
      setItems((prev) => prev?.map((i) => (i.id === qr.id ? { ...i, is_active: !qr.is_active } : i)) ?? null);
    } catch { toast.error('Não foi possível alterar o status.'); }
  }

  async function remove(qr: QrCode) {
    if (!confirm(`Excluir o QR "${qr.name || qr.slug}"? Os scans registrados também serão apagados.`)) return;
    try {
      await api.remove(qr.id);
      setItems((prev) => prev?.filter((i) => i.id !== qr.id) ?? null);
      toast.success('QR excluído.');
      api.overview(30).then(setOverview).catch(() => {});
    } catch { toast.error('Falha ao excluir.'); }
  }

  if (!allowed) return <Blocked />;

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
              <Zap className="h-5 w-5" />
            </span>
            <span className="text-2xl font-bold tracking-tight text-ink-900">Spark QR</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost h-11 w-11 px-0" onClick={load} title="Recarregar">
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-5 w-5" /> Novo QR
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {items === null ? (
          <div className="grid place-items-center py-28 text-ink-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Dashboard data={overview} />

            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink-900">
                Seus QR codes <span className="text-ink-400">({items.length})</span>
              </h2>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
                <input
                  className="input pl-11"
                  placeholder="Buscar…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="card grid place-items-center gap-4 py-20 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <QrIcon className="h-8 w-8" />
                </span>
                <div>
                  <div className="text-lg font-semibold text-ink-900">
                    {query ? 'Nenhum QR encontrado' : 'Nenhum QR ainda'}
                  </div>
                  <div className="mt-1 text-sm text-ink-500">
                    {query ? 'Tente outro termo de busca.' : 'Crie seu primeiro QR dinâmico.'}
                  </div>
                </div>
                {!query && (
                  <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                    <Plus className="h-5 w-5" /> Novo QR
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((qr) => (
                  <QrCard
                    key={qr.id}
                    qr={qr}
                    onAnalytics={() => setAnalytics(qr)}
                    onEdit={() => { setEditing(qr); setFormOpen(true); }}
                    onToggle={() => toggleActive(qr)}
                    onDelete={() => remove(qr)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <QrFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
      <AnalyticsModal qr={analytics} onClose={() => setAnalytics(null)} />
    </div>
  );
}
