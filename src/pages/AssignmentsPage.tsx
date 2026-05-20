import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Search } from 'lucide-react';
import { AssignmentsTable } from '@/components/AssignmentsTable';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { ContactDrawer } from '@/components/ContactDrawer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SkipDialog } from '@/components/SkipDialog';
import { cn } from '@/lib/utils';
import type { AppState, Assignment } from '@/types';

type Period = 'all' | 'today' | '7d' | '30d';

export function AssignmentsPage({ state, refresh }: { state: AppState; refresh: () => void }) {
  const [q, setQ] = useState('');
  const [repFilter, setRepFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState<Period>('all');
  const [skipTarget, setSkipTarget] = useState<Assignment | null>(null);
  const [drawerAssignment, setDrawerAssignment] = useState<Assignment | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const repsById = new Map(state.reps.map((r) => [r.id, r]));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return state.assignments.filter((a) => {
      if (repFilter && a.assigned_rep_id !== repFilter) return false;
      if (statusFilter && a.ghl_sync_status !== statusFilter) return false;
      if (period !== 'all') {
        const ageMs = now - new Date(a.created_at).getTime();
        if (period === 'today' && ageMs > 24 * 3600 * 1000) return false;
        if (period === '7d' && ageMs > 7 * 24 * 3600 * 1000) return false;
        if (period === '30d' && ageMs > 30 * 24 * 3600 * 1000) return false;
      }
      if (q) {
        const term = q.toLowerCase();
        return (
          a.contact_name?.toLowerCase().includes(term) ||
          a.contact_email?.toLowerCase().includes(term) ||
          a.contact_phone?.toLowerCase().includes(term) ||
          a.ghl_contact_id.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [state.assignments, q, repFilter, statusFilter, period]);

  function exportCsv() {
    const headers = ['ID', 'Contato', 'Email', 'Telefone', 'Tags', 'Vendedor', 'Status', 'Sync', 'Recebido em'];
    const rows = filtered.map((a) => [
      a.ghl_contact_id, a.contact_name ?? '', a.contact_email ?? '', a.contact_phone ?? '',
      (a.contact_tags ?? []).join('|'), a.rep_name ?? '',
      a.was_skipped ? 'Pulado' : 'Round-robin',
      a.ghl_sync_status, a.created_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `soneko-assignments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Buscar por nome, email, telefone ou ID... (atalho: /)" className="pl-9" />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-ink-200 bg-white p-0.5">
          {(['all', 'today', '7d', '30d'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      period === p ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100',
                    )}>
              {p === 'all' ? 'Tudo' : p === 'today' ? 'Hoje' : p === '7d' ? '7 dias' : '30 dias'}
            </button>
          ))}
        </div>

        <div className="w-44">
          <Select value={repFilter} onChange={(v) => setRepFilter(v === '__all__' ? undefined : v)}
                  options={[{ value: '__all__', label: 'Todos os vendedores' }, ...state.reps.map((r) => ({ value: r.id, label: r.name }))]}
                  placeholder="Vendedor" />
        </div>
        <div className="w-36">
          <Select value={statusFilter} onChange={(v) => setStatusFilter(v === '__all__' ? undefined : v)}
                  options={[
                    { value: '__all__', label: 'Qualquer sync' },
                    { value: 'synced', label: 'Sincronizado' },
                    { value: 'pending', label: 'Pendente' },
                    { value: 'failed', label: 'Falhou' },
                  ]}
                  placeholder="Sync" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Calendar className="h-3.5 w-3.5" /> CSV</Button>
        <div className="text-xs text-ink-500 ml-auto">
          {filtered.length} de {state.assignments.length}
        </div>
      </div>

      <BulkActionsBar
        selected={selected}
        reps={state.reps}
        onClear={() => setSelected(new Set())}
        onDone={refresh}
      />

      <AssignmentsTable
        assignments={filtered}
        onSkip={setSkipTarget}
        onOpenContact={setDrawerAssignment}
        selectable
        selected={selected}
        onSelectChange={setSelected}
        onRetry={refresh}
      />

      <SkipDialog
        open={!!skipTarget}
        onOpenChange={(v) => !v && setSkipTarget(null)}
        assignment={skipTarget}
        currentRep={skipTarget ? repsById.get(skipTarget.assigned_rep_id ?? '') ?? null : null}
        nextRep={state.next_rep}
        allReps={state.reps}
        onDone={refresh}
      />

      <ContactDrawer
        open={!!drawerAssignment}
        onClose={() => setDrawerAssignment(null)}
        assignment={drawerAssignment}
        rep={drawerAssignment ? repsById.get(drawerAssignment.assigned_rep_id ?? '') ?? null : null}
      />
    </div>
  );
}
