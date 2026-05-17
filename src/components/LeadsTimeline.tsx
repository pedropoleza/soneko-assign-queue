import { Activity } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { formatRelative } from '@/lib/utils';
import type { RecentChip } from '@/types';

export function LeadsTimeline({ chips }: { chips: RecentChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700 shrink-0">
          <Activity className="h-4 w-4" />
        </div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500 shrink-0">
          Últimos leads
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {chips.map((c) => (
            <div key={c.id}
                 className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2 py-1 text-xs shrink-0">
              <Avatar name={c.rep_name ?? '?'} size="xs" />
              <span className="font-medium text-ink-800 truncate max-w-[100px]">{c.rep_name ?? '—'}</span>
              <span className="text-ink-400">·</span>
              <span className="text-ink-500">{formatRelative(c.created_at)}</span>
              {c.was_skipped && <span className="text-amber-600">↺</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
