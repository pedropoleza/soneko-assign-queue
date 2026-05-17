import { cn, colorFromString, initials } from '@/lib/utils';
import { StatusDot } from './StatusDot';

type Status = 'available' | 'unavailable' | 'inactive';

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  status,
}: {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  status?: Status;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  };
  const dotPosition = {
    xs: '-bottom-0.5 -right-0.5',
    sm: '-bottom-0.5 -right-0.5',
    md: 'bottom-0 right-0',
    lg: 'bottom-0.5 right-0.5',
  };
  const inner = src ? (
    <img src={src} alt={name}
         className={cn('rounded-full object-cover border border-ink-200', sizes[size])} />
  ) : (
    <span
      className={cn('inline-flex items-center justify-center rounded-full font-semibold text-white', colorFromString(name), sizes[size])}
      title={name}
    >
      {initials(name)}
    </span>
  );
  if (!status) return <span className={className}>{inner}</span>;
  return (
    <span className={cn('relative inline-block', className)}>
      {inner}
      <span className={cn('absolute', dotPosition[size])}>
        <StatusDot status={status} pulse={status === 'available'} />
      </span>
    </span>
  );
}
