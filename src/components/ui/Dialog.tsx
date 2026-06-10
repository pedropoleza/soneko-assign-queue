import * as RDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: keyof typeof SIZE_MAP;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <RDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
            SIZE_MAP[size],
            'max-h-[85vh] flex flex-col',
            'rounded-xl bg-white shadow-2xl border border-ink-200',
            'focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between border-b border-ink-100 px-5 py-3.5 shrink-0">
            <div>
              <RDialog.Title className="text-base font-semibold text-ink-900">{title}</RDialog.Title>
              {description && (
                <RDialog.Description className="mt-0.5 text-xs text-ink-500">{description}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
              <X className="h-4 w-4" />
            </RDialog.Close>
          </div>
          <div className="px-5 py-4 overflow-y-auto">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
