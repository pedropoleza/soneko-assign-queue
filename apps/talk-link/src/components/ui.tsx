import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'plain' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent text-white hover:bg-accent-deep disabled:bg-accent/40',
  quiet: 'border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40',
  plain: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'border border-danger/25 bg-surface text-danger hover:bg-danger-soft',
};

const SIZE = {
  sm: 'h-8 gap-1.5 rounded-md px-2.5 text-[13px]',
  md: 'h-9 gap-2 rounded-md px-3.5 text-sm',
  lg: 'h-10 gap-2 rounded-md px-5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed',
        SIZE[size],
        VARIANT[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('field', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('field resize-none leading-relaxed', props.className)} />;
}

/** Uma pergunta do formulário: número, título e o controle. */
export function Step({
  n,
  title,
  aside,
  children,
}: {
  n: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex gap-3.5 sm:gap-4">
      <span className="num mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-[12px] font-semibold text-accent-deep">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {aside}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Chip({
  on,
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; icon?: ReactNode }) {
  return (
    <button type="button" {...rest} className={cn('chip', on && 'chip-on', className)}>
      {icon}
      {children}
    </button>
  );
}

export function Tag({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'warn' | 'danger';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'border-line bg-surface-2 text-ink-2',
    accent: 'border-accent/25 bg-accent-soft text-accent-deep',
    warn: 'border-warn/25 bg-warn-soft text-warn',
    danger: 'border-danger/25 bg-danger-soft text-danger',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-accent-soft text-accent-deep">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}
