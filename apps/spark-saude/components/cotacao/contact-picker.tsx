"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, UserRound, Loader2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface PickedContact {
  id?: string;
  name?: string;
}

/**
 * Select the linha_saude contact a quote is for — the input-side bridge to the
 * GHL CRM ("conectado em nível de informação"). Searches the same book the
 * dashboard reads; the picked contact links the quote so the write-backs (tag,
 * plano_escolhido) land on the right person.
 */
export function ContactPicker({ value, onSelect }: { value: PickedContact; onSelect: (c: PickedContact) => void }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const search = useQuery({
    queryKey: ["contacts", q],
    queryFn: () => api.contacts({ q, limit: 8 }),
    enabled: open && q.trim().length >= 2,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (value.id) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={value.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{value.name || "Contato"}</p>
            <p className="text-xs text-muted-foreground">Vinculado ao GHL</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect({})}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Trocar
        </button>
      </div>
    );
  }

  const results = search.data?.items ?? [];

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar contato pelo nome ou e-mail…"
          className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {search.isFetching ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
      </div>

      {open && q.trim().length >= 2 ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-background shadow-card-hover">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">{search.isFetching ? "Buscando…" : "Nenhum contato encontrado."}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect({ id: c.id, name: c.name });
                      setOpen(false);
                      setQ("");
                    }}
                    className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted")}
                  >
                    <Avatar name={c.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email || c.phone || "—"}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onSelect({ id: undefined, name: undefined })}
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <UserRound className="h-3.5 w-3.5" /> Seguir sem vincular contato
      </button>
    </div>
  );
}
