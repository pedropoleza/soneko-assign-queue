import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'glass' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
}) {
  return (
    <button
      className={cn(
        variant === 'primary' && 'btn-primary',
        (variant === 'glass' || variant === 'ghost') && 'btn-glass',
        variant === 'danger' && 'btn-danger',
        size === 'sm' && 'btn-sm',
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-[15px] text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => (
    <textarea ref={ref} {...props} className={cn(inputBase, 'min-h-[96px] resize-y', props.className)} />
  ),
);
Textarea.displayName = 'Textarea';

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, 'appearance-none', props.className)} />;
}

export function Badge({
  tone = 'ink',
  children,
}: {
  tone?: 'ink' | 'green' | 'amber' | 'red' | 'brand';
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    ink: 'border-ink-200 bg-ink-50 text-ink-600',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    brand: 'border-brand-200 bg-brand-50 text-brand-700',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <div className="text-sm font-medium text-ink-700">{title}</div>
      {hint && <div className="text-xs text-ink-400">{hint}</div>}
    </div>
  );
}
