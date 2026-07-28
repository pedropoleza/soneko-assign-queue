"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Search,
  Link2,
  Check,
  Loader2,
  ExternalLink,
  Sparkles,
  Info,
} from "lucide-react";
import { cotacaoApi, type CreateQuoteResult, type SearchOptions } from "@/lib/client/cotacao";
import { LEAO_BRAND } from "@/lib/cotacao/brand";
import { ageFrom } from "@/lib/cotacao/prefill";
import type { EligibilitySummary } from "@/lib/cms";
import type { PlanOptionDraft, PlanQuote, QuotePerson, QuoteProfile } from "@/lib/cotacao/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EstimateNote } from "@/components/cotacao/estimate-note";
import { ContactPicker } from "@/components/cotacao/contact-picker";
import { OptionEditor } from "@/components/cotacao/option-editor";
import { PlanTable } from "@/components/cotacao/plan-table";
import { EligibilityBanner } from "@/components/cotacao/eligibility-banner";
import { ErrorState } from "@/components/ui/data-state";
import { cn, formatMoneyBR } from "@/lib/utils";

const emptyPerson = (relationship: QuotePerson["relationship"] = "Self"): QuotePerson => ({
  age: 30,
  dob: null,
  gender: "Male",
  relationship,
  aptcEligible: true,
  usesTobacco: false,
  utilizationLevel: "Medium",
});

const METAL_FILTERS = ["Bronze", "Silver", "Gold", "Platinum", "Catastrophic"] as const;

/**
 * Which plan year to quote by default. Open Enrollment opens on Nov 1, so from
 * October onward the broker is selling NEXT year; before that she is almost
 * always working the current year (a Special Enrollment mid-year).
 */
function defaultPlanYear(today = new Date()): number {
  return today.getMonth() >= 9 ? today.getFullYear() + 1 : today.getFullYear();
}

const SORTS: Array<{ value: NonNullable<SearchOptions["sort"]>; label: string }> = [
  { value: "premium", label: "Menor prêmio" },
  { value: "deductible", label: "Menor dedutível" },
  { value: "oopc", label: "Menor custo anual" },
  { value: "quality_rating", label: "Melhor avaliação" },
];

/**
 * Ponta A — the broker builds a quote. Laid out as a three-pane cockpit that
 * fills the frame: household on the left, the live plan comparison in the
 * middle, the proposal being assembled on the right. Each pane scrolls on its
 * own so the GHL iframe itself never scrolls (see the dashboard layout).
 */
export function QuoteBuilder() {
  const [profile, setProfile] = React.useState<QuoteProfile>(() => ({
    zipcode: "33073",
    state: "FL",
    income: 33000,
    year: defaultPlanYear(),
    people: [emptyPerson("Self"), emptyPerson("Spouse")],
  }));
  const [plans, setPlans] = React.useState<PlanQuote[] | null>(null);
  const [meta, setMeta] = React.useState<{
    usingFixtures: boolean;
    total: number;
    county: string | null;
    generatedAt: string;
    eligibility: EligibilitySummary | null;
  } | null>(null);
  const [sort, setSort] = React.useState<NonNullable<SearchOptions["sort"]>>("premium");
  const [metals, setMetals] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState<PlanOptionDraft[]>([]);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CreateQuoteResult | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [prefill, setPrefill] = React.useState<{ filled: string[]; notes: string[] } | null>(null);
  const [prefilling, setPrefilling] = React.useState(false);

  const patch = (p: Partial<QuoteProfile>) => setProfile((s) => ({ ...s, ...p }));
  const patchPerson = (i: number, p: Partial<QuotePerson>) =>
    setProfile((s) => ({ ...s, people: s.people.map((pers, idx) => (idx === i ? { ...pers, ...p } : pers)) }));
  const addPerson = () => setProfile((s) => ({ ...s, people: [...s.people, emptyPerson("Child")] }));
  const removePerson = (i: number) => setProfile((s) => ({ ...s, people: s.people.filter((_, idx) => idx !== i) }));

  /** Picking a client pulls their real CRM data into the household. */
  const onPickContact = async (c: { id?: string; name?: string }) => {
    patch({ contactId: c.id, contactName: c.name });
    setPrefill(null);
    if (!c.id) return;
    setPrefilling(true);
    setError(null);
    try {
      const res = await cotacaoApi.prefill(c.id, profile.year);
      setProfile((s) => ({ ...s, ...res.profile, contactId: c.id, contactName: c.name }));
      setPrefill({ filled: res.filled, notes: res.notes });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPrefilling(false);
    }
  };

  const search = async (override?: Partial<SearchOptions>) => {
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const res = await cotacaoApi.search(profile, {
        sort,
        metalLevels: metals.length ? metals : undefined,
        ...override,
      });
      setPlans(res.plans);
      setMeta({
        usingFixtures: res.usingFixtures,
        total: res.total,
        county: res.county,
        generatedAt: res.generatedAt,
        eligibility: res.eligibility,
      });
      if (res.profile) setProfile((s) => ({ ...s, ...res.profile }));
    } catch (e) {
      setError((e as Error).message);
      setPlans(null);
    } finally {
      setSearching(false);
    }
  };

  // Re-run the search when the ordering/filters change — the API sorts, not us.
  const rerun = (next: { sort?: NonNullable<SearchOptions["sort"]>; metals?: string[] }) => {
    if (next.sort) setSort(next.sort);
    if (next.metals) setMetals(next.metals);
    if (plans) void search({ sort: next.sort ?? sort, metalLevels: (next.metals ?? metals).length ? (next.metals ?? metals) : undefined });
  };

  const selectedIds = React.useMemo(() => new Set(draft.map((d) => d.planId)), [draft]);
  const printByPlanId = React.useMemo(
    () => Object.fromEntries(draft.map((d) => [d.planId, d.printUrl])),
    [draft],
  );

  const toggle = (p: PlanQuote) =>
    setDraft((d) => (d.some((x) => x.planId === p.planId) ? d.filter((x) => x.planId !== p.planId) : [...d, { ...p }]));
  const removeOption = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));
  const openEdit = (i: number) => {
    setEditIndex(i);
    setEditorOpen(true);
  };
  const openManualAdd = () => {
    setEditIndex(null);
    setEditorOpen(true);
  };
  const saveOption = (o: PlanQuote) =>
    setDraft((d) => {
      if (editIndex == null) return [...d, o];
      const copy = [...d];
      copy[editIndex] = { ...o, printUrl: copy[editIndex]?.printUrl ?? null };
      return copy;
    });

  /** Attach a print to a plan — selecting it first if it isn't in the draft yet. */
  const attachPrintTo = async (plan: PlanQuote, file: File) => {
    setUploading(plan.planId);
    setError(null);
    try {
      const { url } = await cotacaoApi.uploadPrint(file);
      setDraft((d) => {
        const exists = d.some((x) => x.planId === plan.planId);
        return exists
          ? d.map((o) => (o.planId === plan.planId ? { ...o, printUrl: url } : o))
          : [...d, { ...plan, printUrl: url }];
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
    }
  };
  const clearPrint = (i: number) => setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, printUrl: null } : o)));

  const minPremio = plans?.length ? Math.min(...plans.map((p) => p.premioMensal)) : 0;
  const bestId = plans?.find((p) => p.premioMensal === minPremio)?.planId;

  const generate = async () => {
    if (!draft.length) return;
    setGenerating(true);
    setError(null);
    try {
      setResult(await cotacaoApi.create(profile, draft));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.url || `${location.origin}/proposta/${result.token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    // Below xl there isn't room for three panes side by side, so the cockpit
    // relaxes into a normal stacked flow and `main` takes over the scrolling.
    <div className="grid grid-cols-1 gap-4 xl:h-[calc(100dvh-var(--shell-chrome))] xl:grid-cols-[360px_minmax(0,1fr)_340px]">
      {/* ---------------------------------------------------------------- */}
      {/* Left rail — o perfil da família                                    */}
      {/* ---------------------------------------------------------------- */}
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background">
        <div className="shrink-0 border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Perfil da cotação</h2>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <GroupLabel>Cliente</GroupLabel>
            <ContactPicker value={{ id: profile.contactId, name: profile.contactName }} onSelect={onPickContact} />
            {prefilling ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Puxando dados do CRM…
              </p>
            ) : prefill ? (
              <div className="mt-2 space-y-1.5 rounded-lg border border-primary/25 bg-[rgba(21,94,239,0.05)] px-2.5 py-2">
                {prefill.filled.length ? (
                  <p className="flex items-start gap-1.5 text-[11px] text-primary">
                    <Sparkles className="mt-px h-3 w-3 shrink-0" />
                    <span>Preenchido do CRM: {prefill.filled.join(" · ")}</span>
                  </p>
                ) : null}
                {prefill.notes.map((n) => (
                  <p key={n} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Info className="mt-px h-3 w-3 shrink-0" />
                    <span>{n}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <GroupLabel>Local e renda</GroupLabel>
            <div className="grid grid-cols-2 gap-2.5">
              <label>
                <FieldLabel>CEP</FieldLabel>
                <Input value={profile.zipcode} onChange={(e) => patch({ zipcode: e.target.value })} inputMode="numeric" />
              </label>
              <label>
                <FieldLabel>Estado</FieldLabel>
                <Input value={profile.state} onChange={(e) => patch({ state: e.target.value.toUpperCase().slice(0, 2) })} />
              </label>
              <label>
                <FieldLabel>Renda anual (US$)</FieldLabel>
                <Input type="number" value={profile.income} onChange={(e) => patch({ income: Number(e.target.value) })} />
              </label>
              <label>
                <FieldLabel>Ano do plano</FieldLabel>
                <Input type="number" value={profile.year} onChange={(e) => patch({ year: Number(e.target.value) })} />
              </label>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <GroupLabel className="mb-0">Família · {profile.people.length}</GroupLabel>
              <button
                type="button"
                onClick={addPerson}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Pessoa
              </button>
            </div>

            <div className="divide-y rounded-lg border">
              {profile.people.map((pers, i) => (
                <div key={i} className="p-2.5">
                  <div className="mb-2 flex items-center gap-2">
                    <select
                      value={pers.relationship}
                      onChange={(e) => patchPerson(i, { relationship: e.target.value as QuotePerson["relationship"] })}
                      className="h-7 flex-1 rounded-md border border-input bg-background px-1.5 text-xs font-medium"
                    >
                      {["Self", "Spouse", "Child", "Dependent"].map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <select
                      value={pers.gender}
                      onChange={(e) => patchPerson(i, { gender: e.target.value as QuotePerson["gender"] })}
                      className="h-7 w-20 rounded-md border border-input bg-background px-1.5 text-xs"
                    >
                      <option value="Male">M</option>
                      <option value="Female">F</option>
                    </select>
                    {profile.people.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removePerson(i)}
                        aria-label="Remover pessoa"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-[1fr_64px] gap-2">
                    <label>
                      <span className="mb-0.5 block text-[10px] font-medium text-muted-foreground">
                        Nascimento <span className="text-primary">(preço exato)</span>
                      </span>
                      <input
                        type="date"
                        value={pers.dob ?? ""}
                        onChange={(e) => {
                          const dob = e.target.value || null;
                          patchPerson(i, { dob, age: dob ? ageFrom(dob) ?? pers.age : pers.age });
                        }}
                        className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs"
                      />
                    </label>
                    <label>
                      <span className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Idade</span>
                      <input
                        type="number"
                        value={pers.age}
                        disabled={Boolean(pers.dob)}
                        onChange={(e) => patchPerson(i, { age: Number(e.target.value) })}
                        className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs disabled:bg-muted disabled:text-muted-foreground"
                      />
                    </label>
                  </div>

                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={pers.usesTobacco}
                        onChange={(e) => patchPerson(i, { usesTobacco: e.target.checked })}
                      />
                      Tabaco
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Já tem cobertura (Medicare/empregador) — sai do cálculo do crédito">
                      <input
                        type="checkbox"
                        checked={Boolean(pers.hasMec)}
                        onChange={(e) => patchPerson(i, { hasMec: e.target.checked, aptcEligible: !e.target.checked })}
                      />
                      Já tem plano
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Informe a <strong>data de nascimento</strong> de cada pessoa: o CMS calcula a idade exata na data de
              vigência, que é o que corrige o preço dos dependentes.
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t p-3">
          <Button onClick={() => search()} disabled={searching} className="w-full">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar planos
          </Button>
        </div>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* Center — os planos                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Planos</h2>

          {plans ? (
            <span className="text-xs text-muted-foreground">
              {plans.length}
              {meta && meta.total > plans.length ? ` de ${meta.total}` : ""}
              {meta?.county ? ` · ${meta.county}/${profile.state}` : ""} · a partir de{" "}
              <strong className="text-foreground">{formatMoneyBR(minPremio)}</strong>/mês
            </span>
          ) : null}

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {plans ? (
              <>
                {METAL_FILTERS.map((m) => {
                  const on = metals.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => rerun({ metals: on ? metals.filter((x) => x !== m) : [...metals, m] })}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
                <span className="mx-1 h-4 w-px bg-border" />
                <select
                  value={sort}
                  onChange={(e) => rerun({ sort: e.target.value as NonNullable<SearchOptions["sort"]> })}
                  className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                  aria-label="Ordenar planos"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {meta?.usingFixtures ? <Badge tone="amber">Dados de exemplo</Badge> : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {error ? <ErrorState message={error} /> : null}

          {meta?.eligibility ? <EligibilityBanner eligibility={meta.eligibility} /> : null}

          {searching && !plans ? (
            <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consultando o Marketplace…
            </div>
          ) : !plans ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">Monte o perfil e busque os planos</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Selecione o cliente à esquerda para puxar os dados do CRM, confirme o núcleo familiar e busque a
                estimativa oficial do Marketplace.
              </p>
            </div>
          ) : plans.length === 0 ? (
            <div className="py-24 text-center text-sm text-muted-foreground">
              Nenhum plano encontrado para esse perfil e filtros.
            </div>
          ) : (
            <div className={cn("space-y-3", searching && "opacity-60 transition-opacity")}>
              <PlanTable
                plans={plans}
                selectedIds={selectedIds}
                bestId={bestId}
                onToggle={toggle}
                onAttachPrint={attachPrintTo}
                printByPlanId={printByPlanId}
              />
              {/* Mandatory estimate disclaimer (§7) — quiet for the broker, full
                  callout on the client's proposal. */}
              <EstimateNote text={LEAO_BRAND.disclaimer} variant="inline" />
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Right rail — a proposta sendo montada                              */}
      {/* ---------------------------------------------------------------- */}
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Proposta</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {draft.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {draft.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs leading-relaxed text-muted-foreground">
              Marque os planos que quer propor. Você pode ajustar qualquer campo e anexar o print oficial antes de
              gerar o link.
            </p>
          ) : (
            <ul className="space-y-2">
              {draft.map((o, i) => (
                <li key={o.planId || i} className="rounded-lg border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{o.nomePlano}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {o.seguradora} · {o.metalLevel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      aria-label="Remover"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {formatMoneyBR(o.premioMensal)}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">/mês</span>
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    {o.printUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <a href={o.printUrl} target="_blank" rel="noreferrer" title="Ver print">
                          <img src={o.printUrl} alt="print" className="h-7 w-7 rounded border object-cover" />
                        </a>
                        <button type="button" onClick={() => clearPrint(i)} className="text-muted-foreground hover:text-foreground">
                          remover
                        </button>
                      </>
                    ) : (
                      <label className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void attachPrintTo(o, f);
                          }}
                        />
                        {uploading === o.planId ? <Loader2 className="h-3 w-3 animate-spin" /> : null} anexar print
                      </label>
                    )}
                    <button type="button" onClick={() => openEdit(i)} className="ml-auto font-medium text-primary hover:underline">
                      editar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={openManualAdd}
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-input py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar plano manual
          </button>

          {result ? (
            <div className="mt-3 rounded-lg border border-primary/30 bg-[rgba(21,94,239,0.05)] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Check className="h-3.5 w-3.5" /> Link pronto para enviar
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Válido até {new Date(result.expiresAt).toLocaleDateString("pt-BR")}. O contato foi marcado com{" "}
                <code className="rounded bg-muted px-1">cotacao_enviada</code>.
              </p>
              <Input
                readOnly
                value={result.url || `${typeof location !== "undefined" ? location.origin : ""}/proposta/${result.token}`}
                className="mt-2 h-7 font-mono text-[10px]"
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={copy} className="h-7 flex-1 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
                <a href={`/proposta/${result.token}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir
                  </Button>
                </a>
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t p-3">
          <Button onClick={generate} disabled={!draft.length || generating} className="w-full">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Gerar proposta
          </Button>
        </div>
      </aside>

      <OptionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        option={editIndex != null ? draft[editIndex] ?? null : null}
        onSave={saveOption}
      />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{children}</span>;
}

/** Section divider inside the rail — keeps the form readable without boxes. */
function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </p>
  );
}
