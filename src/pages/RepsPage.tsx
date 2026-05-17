import { RepsManager } from '@/components/RepsManager';
import type { AppState } from '@/types';

export function RepsPage({ state, refresh }: { state: AppState; refresh: () => void }) {
  return (
    <div className="space-y-4">
      <RepsManager reps={state.reps} monthlyByRep={state.stats.monthly_by_rep} onChange={refresh} />
    </div>
  );
}
