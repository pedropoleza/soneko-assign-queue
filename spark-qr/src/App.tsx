import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Copy, ExternalLink, Loader2, Pencil, Plus, QrCode as QrIcon,
  Power, RefreshCw, Search, Trash2, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { publicUrl } from './config';
import type { QrCode } from './types';
import { QrFormModal } from './components/QrFormModal';
import { AnalyticsModal } from './components/AnalyticsModal';

function relTime(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function App() {
  const [items, setItems] = useState<QrCode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QrCode | null>(null);
  const [analytics, setAnalytics] = useState<QrCode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.list());
    } catch {
      toast.error('Falha ao carregar QRs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    } catch { toast.error('Falha ao excluir.'); }
  }

  function copyLink(qr: QrCode) {
    navigator.clipboard.writeText(publicUrl(qr.slug)).then(
      () => toast.success('Link copiado.'),
      () => toast.error('Não foi possível copiar.'),
    );
  }

  const totalScans = items?.reduce((a, i) => a + (i.scans ?? 0), 0) ?? 0;

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-ink-900">Spark QR</span>
            {items && (
              <span className="pill ml-1 hidden sm:inline-flex">
                {items.length} QR{items.length === 1 ? '' : 's'} · {totalScans} scans
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost h-9 w-9 px-0" onClick={load} title="Recarregar">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo QR
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por nome, slug ou destino…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {items === null ? (
          <div className="grid place-items-center py-24 text-ink-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card grid place-items-center gap-3 py-20 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <QrIcon className="h-6 w-6" />
            </span>
            <div>
              <div className="text-sm font-medium text-ink-900">
                {query ? 'Nenhum QR encontrado' : 'Nenhum QR ainda'}
              </div>
              <div className="text-xs text-ink-500">
                {query ? 'Tente outro termo de busca.' : 'Crie seu primeiro QR dinâmico.'}
              </div>
            </div>
            {!query && (
              <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4" /> Novo QR
              </button>
            )}
          </div>
        ) : (
          <div className="card divide-y divide-ink-100 overflow-hidden">
            {filtered.map((qr) => (
              <div key={qr.id} className="flex items-center gap-4 px-4 py-3 hover:bg-ink-50/60 sm:px-5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${qr.is_active ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-400'}`}>
                  <QrIcon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-900">{qr.name || qr.slug}</span>
                    {!qr.is_active && <span className="pill text-ink-400">inativo</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-500">
                    <span className="font-mono text-brand-600">/{qr.slug}</span>
                    <span className="text-ink-300">→</span>
                    <span className="truncate">{qr.target_url}</span>
                  </div>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <div className="text-sm font-semibold tabular-nums text-ink-900">{qr.scans ?? 0}</div>
                  <div className="text-[11px] text-ink-400">
                    {qr.scans_7d ? `+${qr.scans_7d} 7d · ` : ''}{relTime(qr.last_scan_at)}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <button className="btn-ghost h-8 w-8 px-0" title="Copiar link" onClick={() => copyLink(qr)}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <a className="btn-ghost h-8 w-8 px-0" title="Abrir link" href={publicUrl(qr.slug)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button className="btn-ghost h-8 w-8 px-0" title="Analytics" onClick={() => setAnalytics(qr)}>
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost h-8 w-8 px-0" title="Editar" onClick={() => { setEditing(qr); setFormOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className={`btn-ghost h-8 w-8 px-0 ${qr.is_active ? 'text-emerald-600' : 'text-ink-400'}`}
                    title={qr.is_active ? 'Desativar' : 'Ativar'}
                    onClick={() => toggleActive(qr)}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost h-8 w-8 px-0 text-rose-500 hover:bg-rose-50" title="Excluir" onClick={() => remove(qr)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
