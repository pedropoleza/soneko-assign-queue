import { AlertCircle } from "lucide-react";

/**
 * The mandatory, always-visible estimate disclaimer (CLAUDE.md §7). A cotação is
 * NEVER a guaranteed price. Shown on the builder and on the public proposal.
 */
export function EstimateNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-[rgba(247,144,9,0.35)] bg-[rgba(247,144,9,0.08)] px-3.5 py-2.5">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B54708]" />
      <p className="text-xs leading-relaxed text-[#93370D]">{text}</p>
    </div>
  );
}
