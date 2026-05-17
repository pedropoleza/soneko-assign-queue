import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warn';
}) {
  const tones = {
    neutral: 'text-ink-700 bg-ink-100',
    brand: 'text-brand-700 bg-brand-100',
    success: 'text-emerald-700 bg-emerald-100',
    warn: 'text-amber-700 bg-amber-100',
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{value}</div>
          {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
        </div>
        {icon && (
          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', tones[tone])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
