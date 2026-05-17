import { Inbox } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { formatRelative } from '@/lib/utils';
import type { Assignment } from '@/types';

export function LastLeadCard({ assignment }: { assignment: Assignment | null }) {
  return (
    <div className="card px-4 py-2.5 flex items-center gap-3">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700 shrink-0">
        <Inbox className="h-4 w-4" />
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500 shrink-0">
        Último lead
      </div>
      {assignment ? (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ink-300">·</span>
          <span className="text-sm text-ink-700 whitespace-nowrap">{formatRelative(assignment.created_at)}</span>
          <span className="text-ink-300">·</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar name={assignment.rep_name ?? '?'} src={assignment.rep_avatar} size="xs" />
            <span className="text-sm font-medium text-ink-900 truncate">{assignment.rep_name ?? '—'}</span>
          </div>
          {assignment.was_skipped && (
            <span className="inline-flex items-center gap-0.5 text-amber-600 text-xs font-medium" title="Atribuição foi pulada">
              ↺
            </span>
          )}
        </div>
      ) : (
        <span className="text-sm text-ink-400">aguardando primeiro lead…</span>
      )}
    </div>
  );
}
