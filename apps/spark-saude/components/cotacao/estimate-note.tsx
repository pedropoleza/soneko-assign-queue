import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The mandatory, always-visible estimate disclaimer (docs/cotacao.md §7). A
 * cotação is NEVER a guaranteed price.
 *
 * Two weights, because the audience differs: the client-facing proposal shows
 * the full callout (`variant="block"`), while the broker — who already knows
 * this and sees it on every search — gets a quiet one-liner that stays visible
 * without eating the workspace.
 */
export function EstimateNote({ text, variant = "block" }: { text: string; variant?: "block" | "inline" }) {
  if (variant === "inline") {
    return (
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-[#B54708]" />
        <span>{text}</span>
      </p>
    );
  }

  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border border-[rgba(247,144,9,0.35)] bg-[rgba(247,144,9,0.08)] px-3.5 py-2.5")}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B54708]" />
      <p className="text-xs leading-relaxed text-[#93370D]">{text}</p>
    </div>
  );
}
