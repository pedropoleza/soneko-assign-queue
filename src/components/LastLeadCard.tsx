import { Inbox } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { formatRelative } from '@/lib/utils';
import type { Assignment } from '@/types';

export function LastLeadCard({ assignment }: { assignment: Assignment | null }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Último lead</div>
          {assignment ? (
            <>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">
                {formatRelative(assignment.created_at)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500 min-w-0">
                <Avatar name={assignment.rep_name ?? '?'} src={assignment.rep_avatar} size="xs" />
                <span className="truncate">{assignment.rep_name ?? '—'}</span>
                {assignment.was_skipped && (
                  <span className="text-amber-600 font-medium" title="Pulado">↺</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-ink-400">—</div>
              <div className="mt-1 text-xs text-ink-500">aguardando primeiro lead</div>
            </>
          )}
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-100 text-ink-700 shrink-0">
          <Inbox className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
