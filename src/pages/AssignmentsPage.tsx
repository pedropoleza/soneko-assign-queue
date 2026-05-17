import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AssignmentsTable } from '@/components/AssignmentsTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SkipDialog } from '@/components/SkipDialog';
import type { AppState, Assignment } from '@/types';

export function AssignmentsPage({ state, refresh }: { state: AppState; refresh: () => void }) {
  const [q, setQ] = useState('');
  const [repFilter, setRepFilter] = useState<string | undefined>(undefined);
  const [skipTarget, setSkipTarget] = useState<Assignment | null>(null);
  const repsById = new Map(state.reps.map((r) => [r.id, r]));

  const filtered = useMemo(() => {
    return state.assignments.filter((a) => {
      if (repFilter && a.assigned_rep_id !== repFilter) return false;
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
  }, [state.assignments, q, repFilter]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, email, telefone ou ID..."
            className="pl-9"
          />
        </div>
        <div className="w-56">
          <Select
            value={repFilter}
            onChange={(v) => setRepFilter(v === '__all__' ? undefined : v)}
            options={[
              { value: '__all__', label: 'Todos os vendedores' },
              ...state.reps.map((r) => ({ value: r.id, label: r.name })),
            ]}
            placeholder="Filtrar por vendedor"
          />
        </div>
        <div className="text-xs text-ink-500 ml-auto">
          {filtered.length} de {state.assignments.length} atribuições
        </div>
      </div>

      <AssignmentsTable assignments={filtered} onSkip={setSkipTarget} />

      <SkipDialog
        open={!!skipTarget}
        onOpenChange={(v) => !v && setSkipTarget(null)}
        assignment={skipTarget}
        currentRep={skipTarget ? repsById.get(skipTarget.assigned_rep_id ?? '') ?? null : null}
        nextRep={state.next_rep}
        allReps={state.reps}
        onDone={refresh}
      />
    </div>
  );
}
