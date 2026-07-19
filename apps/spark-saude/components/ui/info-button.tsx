"use client";

import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";

/** Small "i" that explains a chart's logic (domain rules from CLAUDE.md). */
export function InfoButton({ text }: { text: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Sobre este gráfico"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-[268px] rounded-lg border bg-background p-3 text-xs leading-relaxed text-muted-foreground shadow-card-hover focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {text}
          <Popover.Arrow className="fill-background" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
