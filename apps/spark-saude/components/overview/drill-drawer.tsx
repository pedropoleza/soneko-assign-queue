"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/data-state";
import { ghlContactUrl, type AppConfig } from "@/lib/client/api";
import { formatDateBR } from "@/lib/utils";
import type { Contact } from "@/lib/types";

/** Lists the contacts behind a clicked metric/segment; each opens in GHL or the 360. */
export function DrillDrawer({
  open,
  onOpenChange,
  title,
  contacts,
  config,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  contacts: Contact[];
  config?: AppConfig;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="flex flex-col p-0">
        <div className="border-b px-5 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? "contato" : "contatos"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nenhum contato" hint="Nada corresponde a esse recorte." />
            </div>
          ) : (
            <ul className="divide-y">
              {contacts.map((c) => {
                const url = ghlContactUrl(config, c.id);
                const sub =
                  [c.fields.seguradora, c.fields.planoEscolhido].filter(Boolean).join(" · ") ||
                  c.email ||
                  c.phone ||
                  "—";
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link
                      href={`/clients?contact=${c.id}`}
                      onClick={() => onOpenChange(false)}
                      className="group flex min-w-0 items-center gap-3"
                    >
                      <Avatar name={c.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium group-hover:text-primary">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{sub}</p>
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.fields.dataRenovacao ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatDateBR(String(c.fields.dataRenovacao))}
                        </span>
                      ) : null}
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir contato no GHL"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
