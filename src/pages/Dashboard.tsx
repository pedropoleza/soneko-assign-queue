import { useState } from 'react';
import { CheckCircle2, SkipForward, Users2, Zap } from 'lucide-react';
import { NextRepCard } from '@/components/NextRepCard';
import { QueueStrip } from '@/components/QueueStrip';
import { StatCard } from '@/components/StatCard';
import { AssignmentsTable } from '@/components/AssignmentsTable';
import { SkipDialog } from '@/components/SkipDialog';
import type { AppState, Assignment } from '@/types';

export function Dashboard({ state, refresh }: { state: AppState; refresh: () => void }) {
  const [skipTarget, setSkipTarget] = useState<Assignment | null>(null);
  const repsById = new Map(state.reps.map((r) => [r.id, r]));
  const lastAssignment = state.assignments[0];

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vendedores ativos"
          value={state.stats.active_reps}
          hint={`${state.reps.length} cadastrados`}
          icon={<Users2 className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard
          label="Atribuições totais"
          value={state.stats.total_assignments}
          hint="histórico completo"
          icon={<Zap className="h-4 w-4" />}
        />
        <StatCard
          label="Pulos manuais"
          value={state.stats.total_skipped}
          hint={state.stats.total_assignments > 0
            ? `${Math.round((state.stats.total_skipped / state.stats.total_assignments) * 100)}% do total`
            : '—'}
          icon={<SkipForward className="h-4 w-4" />}
          tone="warn"
        />
        <StatCard
          label="Sincronização GHL"
          value={state.assignments.filter((a) => a.ghl_sync_status === 'synced').length}
          hint={`de ${state.assignments.length} recentes`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
      </div>

      {/* Next rep + queue */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NextRepCard rep={state.next_rep} />
        </div>
        <div className="lg:col-span-2">
          <QueueStrip
            reps={state.reps}
            nextRepId={state.next_rep?.id}
            lastRepId={state.queue?.last_assigned_rep_id ?? null}
          />
        </div>
      </div>

      {/* Last assignment quick-skip */}
      {lastAssignment && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-100 text-brand-700">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-ink-500">Último lead atribuído</div>
              <div className="text-sm font-medium text-ink-900 truncate">
                {lastAssignment.contact_name ?? lastAssignment.ghl_contact_id}
                <span className="ml-2 text-ink-500 font-normal">→ {lastAssignment.rep_name ?? '—'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSkipTarget(lastAssignment)}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Pular este vendedor
          </button>
        </div>
      )}

      <AssignmentsTable assignments={state.assignments} onSkip={setSkipTarget} />

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
