import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:border-brand-300',
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';
