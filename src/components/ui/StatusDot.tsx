import { cn } from '@/lib/utils';

type Status = 'available' | 'unavailable' | 'inactive';

export function StatusDot({
  status,
  className,
  pulse = false,
}: {
  status: Status;
  className?: string;
  pulse?: boolean;
}) {
  const palette = {
    available: 'bg-emerald-500 border-emerald-200',
    unavailable: 'bg-amber-500 border-amber-200',
    inactive: 'bg-ink-400 border-ink-200',
  } as const;
  return (
    <span className={cn('relative inline-block h-2.5 w-2.5 rounded-full border-2 border-white', palette[status], className)}>
      {pulse && status === 'available' && (
        <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
      )}
    </span>
  );
}

export function repStatus(rep: { active: boolean; available: boolean }): Status {
  if (!rep.active) return 'inactive';
  if (!rep.available) return 'unavailable';
  return 'available';
}
