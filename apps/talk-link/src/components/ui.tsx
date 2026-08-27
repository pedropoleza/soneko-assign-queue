import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'plain' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
};

/**
 * Botões leves: um sólido só para a ação principal, o resto sem contorno.
 * O estado desabilitado vira cinza neutro — azul lavado parecia defeito.
 */
const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-accent text-white shadow-[0_1px_2px_rgb(37_99_235_/_0.25)] hover:bg-[rgb(var(--accent-hover))] ' +
    'active:scale-[0.99] disabled:bg-line disabled:text-ink-3 disabled:shadow-none',
  quiet: 'bg-surface-2 text-ink-2 hover:bg-line hover:text-ink disabled:text-ink-3',
  plain: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'text-danger hover:bg-danger-soft',
};

const SIZE = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
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
        'inline-flex items-center justify-center rounded-full font-medium transition duration-150',
        'disabled:cursor-not-allowed',
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

/** Uma pergunta do formulário. */
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
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-ink">
          <span className="num text-[13px] font-medium text-ink-3">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
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
    neutral: 'bg-surface-2 text-ink-2',
    accent: 'bg-accent-soft text-accent-deep',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
  };
  return <span className={cn('tag', tones[tone])}>{children}</span>;
}

/** Inicial em círculo — usada para influenciador e para contato. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-[13px]', lg: 'h-11 w-11 text-[15px]' };
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent-deep',
        sizes[size],
      )}
    >
      {(name || '?').slice(0, 1).toUpperCase()}
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
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-ink-3">{icon}</div>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}
