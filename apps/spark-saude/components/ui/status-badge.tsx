import { Badge, type BadgeProps } from "./badge";
import type { RenewalStatus } from "@/lib/types";

type Tone = NonNullable<BadgeProps["tone"]>;

const RENEWAL_MAP: Record<RenewalStatus, { tone: Tone; label: string }> = {
  avisado: { tone: "blue", label: "Avisado" },
  pendente: { tone: "amber", label: "Pendente" },
  feito: { tone: "green", label: "Feito" },
  nao_renovou: { tone: "red", label: "Não renovou" },
  sem_status: { tone: "gray", label: "Sem status" },
};

export function RenewalStatusBadge({ status }: { status: RenewalStatus }) {
  const m = RENEWAL_MAP[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function DaysBadge({ days }: { days: number | null }) {
  if (days == null) return <Badge tone="gray">Sem data</Badge>;
  if (days < 0) return <Badge tone="red">{Math.abs(days)}d vencida</Badge>;
  if (days === 0) return <Badge tone="red">Vence hoje</Badge>;
  const tone: Tone = days <= 30 ? "amber" : days <= 60 ? "blue" : "gray";
  return <Badge tone={tone}>em {days}d</Badge>;
}
