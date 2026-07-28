"use client";

import * as React from "react";
import { Shield, Check, X, Loader2, Clock, Star } from "lucide-react";
import { cotacaoApi } from "@/lib/client/cotacao";
import type { PublicProposal } from "@/lib/cotacao/types";
import { PlanCard } from "@/components/cotacao/plan-card";
import { EstimateNote } from "@/components/cotacao/estimate-note";
import { cn } from "@/lib/utils";

/**
 * The client-facing proposal (docs/cotacao.md §4 Ponta B, §8 brand). This is
 * the brokerage's storefront — the one screen a client actually sees — so it
 * shares the Cotação design language: light branded header with the gradient
 * thread, tier-colored plan cards, staggered entrances.
 *
 * The broker's recommended plan (when set) is ordered first and carries a gold
 * ribbon: the client should meet the suggestion before the alternatives.
 */
export function ProposalView({ token }: { token: string }) {
  const [data, setData] = React.useState<PublicProposal | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [errMsg, setErrMsg] = React.useState<string>("");
  const [responses, setResponses] = React.useState<Record<string, "aprovado" | "recusado">>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    cotacaoApi
      .proposal(token)
      .then((p) => {
        if (!alive) return;
        setData(p);
        setResponses(Object.fromEntries(p.options.filter((o) => o.response).map((o) => [o.id, o.response!.decisao])));
        setState("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setErrMsg((e as Error).message);
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const respond = async (optionId: string, decisao: "aprovado" | "recusado") => {
    setBusy(optionId);
    try {
      await cotacaoApi.respond(token, optionId, decisao);
      setResponses((r) => ({ ...r, [optionId]: decisao }));
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const brand = data?.corretora;

  // Recommended first — the client meets the suggestion before the alternatives.
  const options = React.useMemo(() => {
    if (!data) return [];
    const rec = data.recommendedPlanId;
    if (!rec) return data.options;
    return [...data.options].sort((a, b) => (a.planId === rec ? -1 : b.planId === rec ? 1 : 0));
  }, [data]);

  return (
    <div className="leao min-h-screen bg-page">
      {/* Cabeçalho — mesmo fio de marca do produto */}
      <header className="bg-background/90 backdrop-blur">
        <span
          className="block h-[3px] w-full"
          style={{ background: "linear-gradient(90deg, #2563EB 0%, #1B2A4A 55%, #C9962E 100%)" }}
          aria-hidden
        />
        <div className="mx-auto flex h-[53px] max-w-6xl items-center gap-3 border-b px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-semibold tracking-tight" style={{ color: "#1B2A4A" }}>
              {brand?.name ?? "Leao Insurances"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {brand?.tagline ?? "Your future. Our protection."}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-primary">
            Proposta
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        {state === "loading" ? (
          <div className="flex items-center justify-center py-28 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando proposta…
          </div>
        ) : state === "error" ? (
          <div className="animate-fade-up mx-auto max-w-md rounded-[var(--radius)] bg-card p-8 text-center shadow-raise ring-1 ring-border">
            <p className="font-display text-base font-semibold">Não foi possível abrir a proposta</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{errMsg || "Link inválido ou expirado."}</p>
          </div>
        ) : data?.expired ? (
          <div className="animate-fade-up mx-auto max-w-md rounded-[var(--radius)] bg-card p-8 text-center shadow-raise ring-1 ring-border">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 font-display text-base font-semibold">Este link expirou</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Peça uma nova proposta à sua corretora.</p>
          </div>
        ) : data ? (
          <>
            <div className="animate-fade-up text-center">
              <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight" style={{ color: "#1B2A4A" }}>
                Sua proposta de seguro saúde {data.year}
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Estimativa gerada em {new Date(data.createdAt).toLocaleDateString("pt-BR")}. Compare as opções e
                aprove a que preferir — sua corretora recebe a resposta na hora.
              </p>
            </div>

            <div className="mx-auto mt-6 max-w-3xl">
              <EstimateNote text={brand?.disclaimer ?? ""} />
            </div>

            <div
              className={cn(
                "stagger mx-auto mt-8 grid grid-cols-1 gap-5",
                options.length === 1 && "max-w-sm",
                options.length === 2 && "md:max-w-3xl md:grid-cols-2",
                options.length >= 3 && "md:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {options.map((opt) => {
                const decided = responses[opt.id];
                const recommended = data.recommendedPlanId != null && opt.planId === data.recommendedPlanId;
                return (
                  <div key={opt.id} className="relative flex flex-col gap-2.5">
                    {recommended ? (
                      <span className="absolute -top-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white shadow-raise">
                        <Star className="h-3 w-3 fill-current" /> Recomendada pela corretora
                      </span>
                    ) : null}
                    <div className={cn("h-full", recommended && "rounded-[var(--radius)] ring-2 ring-accent/60")}>
                      <PlanCard plan={opt} readOnly printUrl={opt.printUrl} />
                    </div>

                    {decided ? (
                      <div
                        className={cn(
                          "animate-fade-up inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold",
                          decided === "aprovado"
                            ? "bg-[rgba(18,183,106,0.12)] text-[#0E9F6E]"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {decided === "aprovado" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        {decided === "aprovado" ? "Você aprovou esta opção" : "Você recusou esta opção"}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy === opt.id}
                          onClick={() => respond(opt.id, "aprovado")}
                          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-raise transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-raise-lg disabled:translate-y-0 disabled:opacity-60"
                        >
                          {busy === opt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Aprovar
                        </button>
                        <button
                          type="button"
                          disabled={busy === opt.id}
                          onClick={() => respond(opt.id, "recusado")}
                          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-card px-4 text-sm font-medium ring-1 ring-inset ring-border transition-colors hover:bg-muted disabled:opacity-60"
                        >
                          <X className="h-4 w-4" /> Recusar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-12 text-center text-xs text-muted-foreground">
              {brand?.name} · {brand?.tagline}
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
