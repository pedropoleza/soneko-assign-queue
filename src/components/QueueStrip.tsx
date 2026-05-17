import { ChevronRight } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import type { SalesRep } from '@/types';
import { cn } from '@/lib/utils';

export function QueueStrip({
  reps,
  nextRepId,
  lastRepId,
}: {
  reps: SalesRep[];
  nextRepId?: string | null;
  lastRepId?: string | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <div className="card-title">Ordem da Fila</div>
          <div className="text-xs text-ink-500">
            Round-robin entre {reps.filter((r) => r.active).length} consultor(es) ativos
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-500" /> Próximo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-400" /> Último atribuído
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-200" /> Inativo
          </span>
        </div>
      </div>
      <div className="px-5 py-5 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-fit">
          {reps.map((rep, i) => {
            const isNext = rep.id === nextRepId;
            const isLast = rep.id === lastRepId;
            return (
              <div key={rep.id} className="flex items-center gap-2 shrink-0">
                <div
                  className={cn(
                    'group relative flex flex-col items-center rounded-xl border px-3 py-2.5 transition-all min-w-[120px]',
                    isNext
                      ? 'border-brand-300 bg-brand-50 ring-2 ring-brand-200'
                      : isLast
                      ? 'border-ink-300 bg-ink-50'
                      : rep.active
                      ? 'border-ink-200 bg-white hover:border-ink-300'
                      : 'border-ink-200 bg-ink-50 opacity-60',
                  )}
                >
                  {isNext && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white shadow">
                      Próximo
                    </span>
                  )}
                  <Avatar name={rep.name} src={rep.avatar_url} size="sm" />
                  <div className="mt-1.5 text-center leading-tight">
                    <div className="text-[12px] font-medium text-ink-900 truncate max-w-[100px]">
                      {rep.name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-ink-500">#{rep.position}</div>
                  </div>
                </div>
                {i < reps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-ink-300" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
