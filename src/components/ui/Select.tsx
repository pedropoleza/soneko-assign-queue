import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string; disabled?: boolean };

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  className,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <RSelect.Root value={value} onValueChange={onChange}>
      <RSelect.Trigger
        className={cn(
          'inline-flex h-9 w-full items-center justify-between rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-800',
          'hover:bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1',
          'data-[placeholder]:text-ink-400',
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon><ChevronDown className="h-4 w-4 text-ink-400" /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          className="z-50 max-h-[300px] overflow-hidden rounded-md border border-ink-200 bg-white shadow-lg"
          position="popper"
          sideOffset={4}
        >
          <RSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-7 pr-3 text-sm text-ink-800 outline-none',
                  'data-[highlighted]:bg-brand-50 data-[highlighted]:text-brand-700',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <RSelect.ItemIndicator className="absolute left-1.5 inline-flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-brand-600" />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
