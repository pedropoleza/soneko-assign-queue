import * as RSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export function Switch({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'data-[state=checked]:bg-brand-600 data-[state=unchecked]:bg-ink-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        className,
      )}
    >
      <RSwitch.Thumb className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </RSwitch.Root>
  );
}
