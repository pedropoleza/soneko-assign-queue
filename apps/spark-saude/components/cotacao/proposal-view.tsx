"use client";

import * as React from "react";
import { Shield, Check, X, Loader2, Clock } from "lucide-react";
import { cotacaoApi } from "@/lib/client/cotacao";
import type { PublicProposal } from "@/lib/cotacao/types";
import { PlanCard } from "@/components/cotacao/plan-card";
import { EstimateNote } from "@/components/cotacao/estimate-note";

/**
 * The client-facing proposal (CLAUDE.md §4 Ponta B, §8 brand). A premium,
 * branded page: options side by side, the estimate disclaimer visible, and
 * Aprovar / Recusar per option. Decisions post back and sync to the GHL CRM.
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
  const navy = brand?.primary ?? "#1B2A4A";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F4F6F9" }}>
      {/* Brand header */}
      <header className="px-6 py-5 text-white" style={{ background: `linear-gradient(180deg, ${navy}, ${brand?.primaryDeep ?? "#14203A"})` }}>
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">{brand?.name ?? "Leao Insurances"}</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/70">{brand?.tagline ?? "Your future. Our protection."}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {state === "loading" ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando proposta…
          </div>
        ) : state === "error" ? (
          <div className="mx-auto max-w-md rounded-xl border bg-white p-8 text-center">
            <p className="text-sm font-semibold">Não foi possível abrir a proposta</p>
            <p className="mt-1 text-sm text-muted-foreground">{errMsg || "Link inválido ou expirado."}</p>
          </div>
        ) : data?.expired ? (
          <div className="mx-auto max-w-md rounded-xl border bg-white p-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">Este link expirou</p>
            <p className="mt-1 text-sm text-muted-foreground">Peça uma nova proposta à sua corretora.</p>
          </div>
        ) : data ? (
          <>
            <div className="mb-5">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: navy }}>
                Sua proposta de seguro saúde {data.year}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Estimativa gerada em {new Date(data.createdAt).toLocaleDateString("pt-BR")}. Compare as opções e aprove a que preferir.
              </p>
            </div>

            <div className="mb-5">
              <EstimateNote text={brand?.disclaimer ?? ""} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.options.map((opt) => {
                const decided = responses[opt.id];
                return (
                  <div key={opt.id} className="flex flex-col gap-2">
                    <PlanCard plan={opt} readOnly printUrl={opt.printUrl} />
                    {decided ? (
                      <div
                        className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
                          decided === "aprovado" ? "bg-[rgba(18,183,106,0.12)] text-[#0E9F6E]" : "bg-muted text-muted-foreground"
                        }`}
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
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: navy }}
                        >
                          {busy === opt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
                        </button>
                        <button
                          type="button"
                          disabled={busy === opt.id}
                          onClick={() => respond(opt.id, "recusado")}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
                        >
                          <X className="h-4 w-4" /> Recusar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              {brand?.name} · {brand?.tagline}
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
