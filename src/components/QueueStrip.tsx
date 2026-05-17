import { Tag } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { repStatus } from './ui/StatusDot';
import { QueueRepPopover } from './QueueRepPopover';
import type { Assignment, SalesRep } from '@/types';
import { cn } from '@/lib/utils';

export function QueueStrip({
  reps,
  nextRepId,
  lastRepId,
  recentAssignment,
  onRefresh,
  onSkipAssignment,
}: {
  reps: SalesRep[];
  nextRepId?: string | null;
  lastRepId?: string | null;
  recentAssignment: Assignment | null;
  cyclePicksUsed?: number;
  onRefresh: () => void;
  onSkipAssignment: (a: Assignment, targetRepId: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <div className="card-title">Ordem da Fila</div>
          <div className="text-xs text-ink-500">
            Distribuição por <strong>menos atendidos (7d)</strong> · clique para gerenciar
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[10px] text-ink-500">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Disponível</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Indisponível</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ink-400" />Inativo</span>
        </div>
      </div>
      <div className="px-3 py-3">
        <div className="flex flex-wrap items-stretch gap-1.5">
          {reps.map((rep) => {
            const isNext = rep.id === nextRepId;
            const isLast = rep.id === lastRepId;
            const status = repStatus(rep);
            const tagCount = rep.tag_rules.length;

            const chip = (
              <button
                type="button"
                className={cn(
                  'group relative flex flex-col items-center justify-center rounded-lg border transition-all',
                  'flex-1 min-w-[82px] max-w-[120px] px-1.5 py-2',
                  'cursor-pointer hover:scale-[1.04] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400',
                  isNext
                    ? 'border-brand-300 bg-brand-50 ring-2 ring-brand-200'
                    : isLast
                    ? 'border-ink-300 bg-ink-50'
                    : status === 'unavailable'
                    ? 'border-amber-200 bg-amber-50/40'
                    : status === 'inactive'
                    ? 'border-ink-200 bg-ink-50 opacity-60'
                    : 'border-ink-200 bg-white hover:border-brand-300',
                )}
              >
                {isNext && (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-1.5 py-0 text-[8px] font-semibold uppercase text-white shadow animate-pulse leading-tight">
                    Próximo
                  </span>
                )}
                {tagCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-violet-100 text-violet-700 border border-violet-200 h-4 min-w-[16px] px-1 text-[9px] font-semibold"
                    title={rep.tag_rules.join(', ')}
                  >
                    <Tag className="h-2 w-2 mr-0.5" />{tagCount}
                  </span>
                )}
                <Avatar name={rep.name} src={rep.avatar_url} size="xs" status={status} />
                <div className="mt-1 text-center leading-tight w-full">
                  <div className="text-[11px] font-medium text-ink-900 truncate">
                    {rep.name.split(' ')[0]}
                  </div>
                  <div className="text-[9px] text-ink-500 tabular-nums">
                    {rep.recent_leads}{rep.weight > 1 && ` · ${rep.weight}x`}
                  </div>
                </div>
              </button>
            );

            return (
              <QueueRepPopover
                key={rep.id}
                trigger={chip}
                rep={rep}
                isNext={isNext}
                recentAssignment={recentAssignment}
                onAction={onRefresh}
                onSkipAssignment={onSkipAssignment}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
