"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/data-state";
import { humanizeTag } from "@/lib/labels";
import { formatDateBR, formatMoneyBR } from "@/lib/utils";
import type { Contact, ContactFields } from "@/lib/types";

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t px-5 py-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <dl className="divide-y divide-border/60">{children}</dl>
    </div>
  );
}

function f(fields: ContactFields, key: keyof ContactFields): string | undefined {
  const v = fields[key];
  return v == null ? undefined : String(v);
}

function Body({ contact, ghlUrl }: { contact: Contact; ghlUrl?: string }) {
  const fields = contact.fields;
  return (
    <div className="overflow-y-auto">
      <div className="flex items-center justify-between gap-3 px-5 py-4 pr-12">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={contact.name} className="h-11 w-11 text-sm" />
          <div className="min-w-0">
            <DialogTitle className="truncate">{contact.name}</DialogTitle>
            <p className="truncate text-sm text-muted-foreground">{contact.email || contact.phone || "—"}</p>
          </div>
        </div>
        {ghlUrl ? (
          <a
            href={ghlUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir contato no GHL"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>

      {contact.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {contact.tags.map((t) => (
            <Badge key={t} tone="gray">
              {humanizeTag(t)}
            </Badge>
          ))}
        </div>
      ) : null}

      <Section title="Plano">
        <Field label="Seguradora" value={f(fields, "seguradora")} />
        <Field label="Plano escolhido" value={f(fields, "planoEscolhido")} />
        <Field label="Prêmio mensal" value={fields.monthlyPremium != null ? formatMoneyBR(Number(fields.monthlyPremium)) : undefined} />
        <Field label="Forma de pagamento" value={f(fields, "formaPagamento")} />
        <Field label="Válido a partir de" value={fields.validoAPartir ? formatDateBR(String(fields.validoAPartir)) : undefined} />
        <Field label="Data de renovação" value={fields.dataRenovacao ? formatDateBR(String(fields.dataRenovacao)) : undefined} />
      </Section>

      <Section title="Status">
        <Field label="Documentação recebida" value={f(fields, "documentacaoRecebida")} />
        <Field label="Underwriting" value={f(fields, "underwritingStatus")} />
        <Field label="Intenção de renovar" value={f(fields, "intencaoRenovar")} />
      </Section>

      <Section title="Casa e renda">
        <Field label="Pessoas na casa" value={f(fields, "pessoasNaCasa")} />
        <Field label="Pessoas no seguro" value={f(fields, "pessoasNoSeguro")} />
        <Field label="Renda da casa" value={fields.rendaCasa != null ? formatMoneyBR(Number(fields.rendaCasa)) : undefined} />
        <Field label="Idioma" value={f(fields, "idioma")} />
      </Section>

      <Section title="Documentos">
        <p className="py-1 text-xs text-muted-foreground">
          Os arquivos (SSN, passaporte, comprovantes) ficam na aba <b>Documents</b> nativa do contato no GHL. Aqui
          mostramos apenas o status de documentação.
        </p>
        <Field label="Status" value={f(fields, "documentacaoRecebida")} />
      </Section>
    </div>
  );
}

export function Client360({
  contactId,
  open,
  onOpenChange,
  ghlUrl,
}: {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ghlUrl?: string;
}) {
  const q = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => api.contact(contactId as string),
    enabled: open && !!contactId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="p-0">
        {q.isLoading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : q.isError ? (
          <div className="p-5">
            <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
          </div>
        ) : q.data ? (
          <Body contact={q.data} ghlUrl={ghlUrl} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
