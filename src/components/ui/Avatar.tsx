import { cn, colorFromString, initials } from '@/lib/utils';

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover border border-ink-200', sizes[size], className)}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-white',
        colorFromString(name),
        sizes[size],
        className,
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
