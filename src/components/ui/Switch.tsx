import * as RSwitch from '@radix-ui/react-switch';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Switch({
  checked,
  onCheckedChange,
  className,
  tone = 'emerald',
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
  tone?: 'emerald' | 'brand';
}) {
  const onBg = tone === 'emerald'
    ? 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-400 data-[state=checked]:to-emerald-600'
    : 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-brand-400 data-[state=checked]:to-brand-600';
  const iconColor = tone === 'emerald' ? 'text-emerald-600' : 'text-brand-600';

  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
        'transition-all duration-300 ease-out',
        'shadow-[inset_0_1px_3px_rgba(15,23,42,0.18)]',
        'data-[state=unchecked]:bg-ink-300',
        onBg,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        tone === 'emerald' ? 'focus-visible:ring-emerald-400' : 'focus-visible:ring-brand-400',
        'active:scale-95',
        className,
      )}
    >
      <RSwitch.Thumb
        className={cn(
          'pointer-events-none relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white',
          'shadow-[0_1px_2px_rgba(15,23,42,0.3)]',
          'translate-x-0.5 transition-transform duration-300 ease-out',
          'data-[state=checked]:translate-x-[22px]',
        )}
      >
        <Check className={cn('h-3 w-3 transition-all duration-200', iconColor,
          'opacity-0 scale-50 group-data-[state=checked]:opacity-100 group-data-[state=checked]:scale-100')} />
        <X className={cn('absolute h-3 w-3 text-ink-400 transition-all duration-200',
          'opacity-100 scale-100 group-data-[state=checked]:opacity-0 group-data-[state=checked]:scale-50')} />
      </RSwitch.Thumb>
    </RSwitch.Root>
  );
}
