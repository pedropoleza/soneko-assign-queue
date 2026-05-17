import { useState } from 'react';
import { SkipForward, Users2, Zap } from 'lucide-react';
import { NextRepCard } from '@/components/NextRepCard';
import { QueueStrip } from '@/components/QueueStrip';
import { StatCard } from '@/components/StatCard';
import { AssignmentsTable } from '@/components/AssignmentsTable';
import { SkipDialog } from '@/components/SkipDialog';
import { ContactDrawer } from '@/components/ContactDrawer';
import { DistributionChart } from '@/components/DistributionChart';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import type { AppState, Assignment } from '@/types';

export function Dashboard({ state, refresh }: { state: AppState; refresh: () => void }) {
  const [skipTarget, setSkipTarget] = useState<Assignment | null>(null);
  const [skipForcedRepId, setSkipForcedRepId] = useState<string | null>(null);
  const [drawerAssignment, setDrawerAssignment] = useState<Assignment | null>(null);
  const repsById = new Map(state.reps.map((r) => [r.id, r]));
  const recent = state.assignments.slice(0, 20);
  const lastAssignment = state.assignments[0] ?? null;

  function openSkipForced(a: Assignment, repId: string) {
    setSkipForcedRepId(repId);
    setSkipTarget(a);
  }

  return (
    <div className="space-y-5">
      <SyncStatusBar
        failed={state.stats.total_failed}
        totalRecent={state.stats.total_assignments}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Disponíveis agora"
          value={state.stats.available_reps}
          hint={`${state.stats.active_reps} ativos · ${state.reps.length} cadastrados`}
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1"><NextRepCard rep={state.next_rep} /></div>
        <div className="lg:col-span-2">
          <QueueStrip
            reps={state.reps}
            nextRepId={state.next_rep?.id}
            lastRepId={state.queue?.last_assigned_rep_id ?? null}
            recentAssignment={lastAssignment}
            cyclePicksUsed={state.queue?.current_rep_picks_used ?? 0}
            onRefresh={refresh}
            onSkipAssignment={openSkipForced}
          />
        </div>
      </div>

      <DistributionChart days={30} />

      <AssignmentsTable
        assignments={recent}
        onSkip={setSkipTarget}
        onOpenContact={setDrawerAssignment}
        onRetry={refresh}
      />

      <SkipDialog
        open={!!skipTarget}
        onOpenChange={(v) => { if (!v) { setSkipTarget(null); setSkipForcedRepId(null); } }}
        assignment={skipTarget}
        currentRep={skipTarget ? repsById.get(skipTarget.assigned_rep_id ?? '') ?? null : null}
        nextRep={state.next_rep}
        allReps={state.reps}
        forcedRepId={skipForcedRepId}
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
