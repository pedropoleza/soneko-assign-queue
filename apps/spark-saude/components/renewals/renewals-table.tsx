"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, ArrowRightCircle } from "lucide-react";
import { api } from "@/lib/client/api";
import type { RenewalItem } from "@/lib/types";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RenewalStatusBadge, DaysBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatDateBR, formatMoneyBR } from "@/lib/utils";

type PendingAction =
  | { item: RenewalItem; kind: "avisado" }
  | { item: RenewalItem; kind: "pendente" }
  | null;

export function RenewalsTable({ items }: { items: RenewalItem[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pending, setPending] = React.useState<PendingAction>(null);

  const mutation = useMutation({
    mutationFn: async (action: NonNullable<PendingAction>) => {
      const id = action.item.contactId;
      if (action.kind === "avisado") {
        await api.addTags(id, ["renovacao_avisada"]);
        await api.removeTags(id, ["renovacao_pendente"]);
      } else {
        await api.addTags(id, ["renovacao_pendente"]);
        await api.removeTags(id, ["renovacao_avisada"]);
      }
    },
    onSuccess: (_data, action) => {
      toast({
        tone: "success",
        title: action.kind === "avisado" ? "Marcado como avisado" : "Puxado para renovação pendente",
        description: action.item.name,
      });
      qc.invalidateQueries({ queryKey: ["renewals"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setPending(null);
    },
    onError: (err: Error) => {
      toast({ tone: "error", title: "Não foi possível salvar", description: err.message });
    },
  });

  return (
    <>
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Cliente</TH>
            <TH>Seguradora / plano</TH>
            <TH>Prêmio</TH>
            <TH>Renovação</TH>
            <TH>Status</TH>
            <TH className="text-right">Ações</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((r) => (
            <TR key={r.contactId}>
              <TD>
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.email || r.phone || "—"}</p>
                  </div>
                </div>
              </TD>
              <TD>
                <p className="text-sm">{r.seguradora || "—"}</p>
                <p className="text-xs text-muted-foreground">{r.planoEscolhido || "—"}</p>
              </TD>
              <TD className="text-sm tabular-nums">{formatMoneyBR(r.monthlyPremium)}</TD>
              <TD>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums">{formatDateBR(r.dataRenovacao)}</span>
                  <DaysBadge days={r.daysUntil} />
                </div>
              </TD>
              <TD>
                <RenewalStatusBadge status={r.status} />
              </TD>
              <TD>
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="subtle"
                    size="xs"
                    disabled={r.status === "avisado" || mutation.isPending}
                    onClick={() => setPending({ item: r, kind: "avisado" })}
                  >
                    <BellRing /> Avisado
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={r.status === "pendente" || mutation.isPending}
                    onClick={() => setPending({ item: r, kind: "pendente" })}
                  >
                    <ArrowRightCircle /> Pendente
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        loading={mutation.isPending}
        title={pending?.kind === "avisado" ? "Marcar como avisado?" : "Puxar para renovação pendente?"}
        description={
          pending ? (
            <>
              {pending.kind === "avisado" ? (
                <>
                  Vai adicionar a tag <b>renovacao_avisada</b> em <b>{pending.item.name}</b> e remover{" "}
                  <b>renovacao_pendente</b>.
                </>
              ) : (
                <>
                  Vai adicionar a tag <b>renovacao_pendente</b> em <b>{pending.item.name}</b> e remover{" "}
                  <b>renovacao_avisada</b>.
                </>
              )}
            </>
          ) : null
        }
        confirmLabel={pending?.kind === "avisado" ? "Marcar avisado" : "Puxar p/ pendente"}
        onConfirm={() => pending && mutation.mutate(pending)}
      />
    </>
  );
}
