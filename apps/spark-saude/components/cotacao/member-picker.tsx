"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, Loader2, Plus, Search, UserRound, X, Check } from "lucide-react";
import { api } from "@/lib/client/api";
import type { Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PickedMember {
  id: string;
  name: string;
  dateOfBirth?: string;
  gender?: string;
}

/**
 * Attach a household member to a CRM contact — inline, per person row.
 *
 * Searches ALL contacts (dependents rarely carry the linha_saude tag), and when
 * the person doesn't exist yet offers creation on the spot with only a name
 * required: a child without phone or e-mail is the normal case, not an error.
 * The actual family link (association to the policyholder) happens at proposal
 * time, server-side.
 */
export function MemberPicker({
  value,
  defaults,
  onSelect,
}: {
  value: { id?: string | null; name?: string | null };
  /** What the row already knows — creation carries it into the CRM upsert. */
  defaults?: { dateOfBirth?: string | null; gender?: "male" | "female" };
  onSelect: (member: PickedMember | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [mode, setMode] = React.useState<"buscar" | "criar">("buscar");
  const [form, setForm] = React.useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const search = useQuery({
    queryKey: ["member-search", q],
    queryFn: () => api.contacts({ q, limit: 6, all: true }),
    enabled: open && mode === "buscar" && q.trim().length >= 2,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (c: Contact) => {
    onSelect({ id: c.id, name: c.name, dateOfBirth: c.dateOfBirth, gender: undefined });
    setOpen(false);
    setQ("");
  };

  const create = async () => {
    if (!form.firstName.trim()) {
      setError("Informe ao menos o nome.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await api.createContact({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        dateOfBirth: defaults?.dateOfBirth || undefined,
        gender: defaults?.gender,
      });
      onSelect({ id: res.id, name: res.name });
      setOpen(false);
      setForm({ firstName: "", lastName: "", phone: "", email: "" });
      setMode("buscar");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // Vinculado — chip com o nome e a opção de desvincular.
  if (value.id) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary/10 pl-2.5 pr-1.5 text-xs font-medium text-primary">
        <Link2 className="h-3 w-3" />
        <span className="max-w-[160px] truncate">{value.name || "Contato"}</span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Desvincular contato"
          className="rounded-full p-0.5 transition-colors hover:bg-primary/15"
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-input px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
      >
        <UserRound className="h-3.5 w-3.5" /> Vincular contato
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-[300px] rounded-lg border bg-card p-3 shadow-card-hover">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs font-medium">
            {(["buscar", "criar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 capitalize transition-colors",
                  mode === m ? "bg-card shadow-card" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "buscar" ? "Buscar no CRM" : "Criar novo"}
              </button>
            ))}
          </div>

          {mode === "buscar" ? (
            <>
              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nome, e-mail ou telefone…"
                  className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm"
                />
                {search.isFetching ? (
                  <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </div>
              {q.trim().length >= 2 ? (
                (search.data?.items?.length ?? 0) > 0 ? (
                  <ul className="mt-1.5 max-h-48 overflow-y-auto">
                    {search.data!.items.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pick(c);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{c.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {c.email || c.phone || "sem contato"}
                            </span>
                          </span>
                          {c.dateOfBirth ? (
                            <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              nasc. ok
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : !search.isFetching ? (
                  <div className="mt-2 rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
                    Ninguém com esse nome.{" "}
                    <button type="button" onClick={() => setMode("criar")} className="font-medium text-primary hover:underline">
                      Criar contato
                    </button>
                  </div>
                ) : null
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Digite ao menos 2 letras para buscar.</p>
              )}
            </>
          ) : (
            <div className="mt-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  autoFocus
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Nome *"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                />
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Sobrenome"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Telefone (opcional)"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="E-mail (opcional)"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
              {error ? <p className="text-xs text-status-red-fg">{error}</p> : null}
              <button
                type="button"
                onClick={create}
                disabled={creating}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar e vincular
              </button>
              <p className="flex items-start gap-1 text-xs leading-snug text-muted-foreground">
                <Check className="mt-px h-3 w-3 shrink-0" />
                Ao gerar a proposta, vinculamos este contato ao titular no GHL (associação familiar).
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
