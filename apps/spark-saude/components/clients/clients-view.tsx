"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search, ExternalLink } from "lucide-react";
import { api, ghlContactUrl } from "@/lib/client/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingRows, ErrorState, EmptyState } from "@/components/ui/data-state";
import { Client360 } from "@/components/clients/client-360";
import { humanizeTag } from "@/lib/labels";
import { formatDateBR } from "@/lib/utils";

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ClientsView() {
  const searchParams = useSearchParams();
  const [term, setTerm] = React.useState("");
  const debounced = useDebounced(term.trim());

  const [selected, setSelected] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const config = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Infinity });

  // Deep-link from the Overview "Abrir" action (?contact=<id>).
  React.useEffect(() => {
    const id = searchParams.get("contact");
    if (id) {
      setSelected(id);
      setOpen(true);
    }
  }, [searchParams]);

  const query = useInfiniteQuery({
    queryKey: ["contacts", debounced],
    queryFn: ({ pageParam }) => api.contacts({ q: debounced || undefined, cursor: pageParam, limit: 25 }),
    initialPageParam: undefined as (string | number)[] | undefined,
    getNextPageParam: (last) => last.nextCursor?.searchAfter ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const openContact = (id: string) => {
    setSelected(id);
    setOpen(true);
  };

  return (
    <div>
      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por nome, email ou telefone…"
          className="pl-9"
        />
      </div>

      <Card>
        <div className="p-3">
          {query.isLoading ? (
            <LoadingRows rows={8} />
          ) : query.isError ? (
            <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={debounced ? "Nenhum cliente encontrado" : "Nenhum cliente na linha saúde"}
              hint={debounced ? "Tente outro termo de busca." : "Contatos com a tag linha_saude aparecem aqui."}
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Cliente</TH>
                    <TH>Seguradora / plano</TH>
                    <TH>Renovação</TH>
                    <TH>Tags</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {items.map((c) => (
                    <TR key={c.id} className="cursor-pointer" onClick={() => openContact(c.id)}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.email || c.phone || "—"}</p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <p className="text-sm">{(c.fields.seguradora as string) || "—"}</p>
                        <p className="text-xs text-muted-foreground">{(c.fields.planoEscolhido as string) || "—"}</p>
                      </TD>
                      <TD className="text-sm tabular-nums">
                        {c.fields.dataRenovacao ? formatDateBR(String(c.fields.dataRenovacao)) : "—"}
                      </TD>
                      <TD>
                        <div className="flex max-w-[240px] flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((t) => (
                            <Badge key={t} tone="gray">
                              {humanizeTag(t)}
                            </Badge>
                          ))}
                          {c.tags.length > 3 ? <Badge tone="gray">+{c.tags.length - 3}</Badge> : null}
                        </div>
                      </TD>
                      <TD>
                        {ghlContactUrl(config.data, c.id) ? (
                          <a
                            href={ghlContactUrl(config.data, c.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Abrir contato no GHL"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {query.hasNextPage ? (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                  >
                    {query.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Card>

      <Client360
        contactId={selected}
        open={open}
        onOpenChange={setOpen}
        ghlUrl={selected ? ghlContactUrl(config.data, selected) : undefined}
      />
    </div>
  );
}
