import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TrendArrow({
  current,
  previous,
  className,
}: {
  current: number;
  previous: number;
  className?: string;
}) {
  if (previous === 0 && current === 0) {
    return <span className={cn('inline-flex items-center gap-0.5 text-[10px] text-ink-400', className)}><Minus className="h-3 w-3" /></span>;
  }
  if (previous === 0) {
    return <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600', className)}><TrendingUp className="h-3 w-3" />novo</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return <span className={cn('inline-flex items-center gap-0.5 text-[10px] text-ink-400', className)}><Minus className="h-3 w-3" />0%</span>;
  }
  const up = pct > 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium',
      up ? 'text-emerald-600' : 'text-rose-600',
      className,
    )}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{pct}%
    </span>
  );
}
