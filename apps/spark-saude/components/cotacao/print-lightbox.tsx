"use client";

import * as React from "react";
import { ExternalLink, Paperclip, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * O print do plano, anexado à opção (respaldo visual — docs/cotacao.md §6).
 *
 * Duas decisões aqui. A primeira é abrir o print DENTRO do app: o dashboard roda
 * num iframe do GHL, e mandar a corretora para outra aba com uma URL assinada
 * gigante era a pior saída possível — ela perdia a tela da cotação. A segunda é
 * de custo: cada print é um screenshot em resolução cheia, e a miniatura pesa o
 * mesmo que a imagem inteira. Então a miniatura carrega em `lazy` e a imagem
 * grande só é montada quando o visor abre.
 */
export function PrintAttachment({
  url,
  /** De onde veio o print — a seguradora. Vira o subtítulo e o título do visor. */
  source,
  className,
}: {
  url: string;
  source?: string | null;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const title = source ? `Print · ${source}` : "Print da seguradora";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Ver o print em tamanho real"
          className={cn(
            "group/print flex w-full items-center gap-2.5 rounded-lg border bg-muted/30 p-2 text-left transition-colors hover:border-primary/40 hover:bg-muted",
            className,
          )}
        >
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md ring-1 ring-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover/print:scale-110"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-foreground/45 opacity-0 transition-opacity group-hover/print:opacity-100">
              <ZoomIn className="h-4 w-4 text-background" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" /> Print anexado
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {source || "Clique para ampliar"}
            </span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 pr-12">
          <p className="text-sm font-semibold">{title}</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir original
          </a>
        </div>
        {/* Montado só com o visor aberto — o print cheio não pesa na listagem. */}
        {open ? (
          <div className="max-h-[74vh] overflow-auto bg-muted/40 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={title} className="mx-auto w-full rounded-md shadow-card" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
