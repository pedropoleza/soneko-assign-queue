import { Ban, Tag } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { repStatus } from './ui/StatusDot';
import { QueueRepPopover } from './QueueRepPopover';
import type { Assignment, SalesRep } from '@/types';
import { cn, formatRelative } from '@/lib/utils';

export function QueueStrip({
  reps,
  nextRepId,
  lastRepId,
  recentAssignment,
  cyclePicksUsed,
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
            Distribuição automática por <strong>menos atendidos</strong> nos últimos 7 dias. Clique pra gerenciar.
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Disponível</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Indisponível</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-400" />Inativo</span>
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
          {reps.map((rep) => {
            const isNext = rep.id === nextRepId;
            const isLast = rep.id === lastRepId;
            const status = repStatus(rep);
            const tagCount = rep.tag_rules.length;
            const showCycle = isLast && rep.weight > 1 && (cyclePicksUsed ?? 0) > 0;

            const isInactive = status === 'inactive';
            const chip = (
              <button
                type="button"
                className={cn(
                  'group relative flex w-full flex-col items-center rounded-xl border px-2 py-2.5 transition-all',
                  'cursor-pointer hover:scale-[1.03] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1',
                  isNext
                    ? 'border-brand-300 bg-brand-50 ring-2 ring-brand-200'
                    : isLast
                    ? 'border-ink-300 bg-ink-50'
                    : status === 'unavailable'
                    ? 'border-amber-200 bg-amber-50/40'
                    : isInactive
                    ? 'border-rose-200 bg-rose-50/40 saturate-0'
                    : 'border-ink-200 bg-white hover:border-brand-300',
                )}
              >
                {/* Inactive: diagonal "OFF" stripe overlay */}
                {isInactive && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(135deg, rgba(244,63,94,0.06) 0 6px, transparent 6px 14px)',
                    }}
                  />
                )}
                {isNext && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white shadow animate-pulse">
                    Próximo
                  </span>
                )}
                {isInactive && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-0.5 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
                    <Ban className="h-2.5 w-2.5" /> Fora
                  </span>
                )}
                {tagCount > 0 && !isInactive && (
                  <span
                    className="absolute -top-2 right-1 inline-flex items-center gap-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 text-[9px] font-semibold"
                    title={rep.tag_rules.join(', ')}
                  >
                    <Tag className="h-2.5 w-2.5" />{tagCount}
                  </span>
                )}
                <div className={cn('relative', isInactive && 'grayscale')}>
                  <Avatar name={rep.name} src={rep.avatar_url} size="sm" status={status} />
                </div>
                <div className="mt-1.5 text-center leading-tight w-full relative">
                  <div className={cn(
                    'text-[12px] font-medium truncate',
                    isInactive ? 'text-ink-500 line-through decoration-rose-400/60 decoration-1' : 'text-ink-900',
                  )}>
                    {rep.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-ink-500 tabular-nums">
                    {rep.recent_leads} lead{rep.recent_leads === 1 ? '' : 's'} · 7d
                    {rep.weight > 1 && ` · ${rep.weight}x`}
                  </div>
                  <div className={cn('text-[10px] truncate', isInactive ? 'text-rose-600 font-medium' : 'text-ink-400')}>
                    {isInactive
                      ? 'não recebe leads'
                      : rep.last_assigned_at
                      ? `último ${formatRelative(rep.last_assigned_at)}`
                      : 'sem leads ainda'}
                  </div>
                  {showCycle && (
                    <div className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-brand-100 text-brand-700 px-1.5 text-[9px] font-medium">
                      ciclo {cyclePicksUsed}/{rep.weight}
                    </div>
                  )}
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
