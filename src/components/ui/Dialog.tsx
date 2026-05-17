import * as RDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <RDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-xl bg-white shadow-2xl border border-ink-200',
            'focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
            <div>
              <RDialog.Title className="text-base font-semibold text-ink-900">{title}</RDialog.Title>
              {description && (
                <RDialog.Description className="mt-1 text-sm text-ink-500">{description}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
              <X className="h-4 w-4" />
            </RDialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
