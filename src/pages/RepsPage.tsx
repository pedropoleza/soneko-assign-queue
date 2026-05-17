import { RepsManager } from '@/components/RepsManager';
import { TagRulesManager } from '@/components/TagRulesManager';
import type { AppState, SalesRep } from '@/types';

export function RepsPage({
  state, refresh, mutateRep,
}: {
  state: AppState;
  refresh: () => void;
  mutateRep: (id: string, patch: Partial<SalesRep>) => void;
}) {
  return (
    <div className="space-y-4">
      <RepsManager
        reps={state.reps}
        monthlyByRep={state.stats.monthly_by_rep}
        onChange={refresh}
        mutateRep={mutateRep}
      />
      <TagRulesManager reps={state.reps} />
    </div>
  );
}
