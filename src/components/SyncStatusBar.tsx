import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SyncStatusBar({
  failed,
  totalRecent,
}: {
  failed: number;
  totalRecent: number;
}) {
  const ok = failed === 0;
  return (
    <div className={cn(
      'card px-4 py-3 flex items-center gap-3',
      ok ? '' : 'border-rose-200 bg-rose-50/40',
    )}>
      <div className={cn(
        'grid h-8 w-8 place-items-center rounded-lg shrink-0',
        ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
      )}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Sincronização com GHL
        </div>
        <div className="text-sm">
          {ok ? (
            <span className="text-ink-800">
              <span className="font-semibold text-emerald-700">Tudo sincronizado</span>
              <span className="ml-2 text-ink-500">· {totalRecent} atribuições no histórico</span>
            </span>
          ) : (
            <span className="text-ink-800">
              <span className="font-semibold text-rose-700">{failed}</span> com falha
              <span className="ml-2 text-ink-500">· retry automático a cada 2min</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
