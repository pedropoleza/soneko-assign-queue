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
  ArrowLeft,
  ImagePlus,
  Pencil,
} from "lucide-react";
import { cotacaoApi, type CreateQuoteResult, type SearchOptions } from "@/lib/client/cotacao";
import { LEAO_BRAND } from "@/lib/cotacao/brand";
import { ageFrom } from "@/lib/cotacao/prefill";
import { buildClientMessage } from "@/lib/cotacao/message";
import type { EligibilitySummary } from "@/lib/cms";
import type { PlanOptionDraft, PlanQuote, QuotePerson, QuoteProfile } from "@/lib/cotacao/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EstimateNote } from "@/components/cotacao/estimate-note";
import { ContactPicker } from "@/components/cotacao/contact-picker";
import { OptionEditor } from "@/components/cotacao/option-editor";
import { PlanCard } from "@/components/cotacao/plan-card";
import { EligibilityBanner } from "@/components/cotacao/eligibility-banner";
import { ErrorState } from "@/components/ui/data-state";
import { cn, formatMoneyBR } from "@/lib/utils";

const RELATIONSHIP_LABEL: Record<QuotePerson["relationship"], string> = {
  Self: "Titular",
  Spouse: "Cônjuge",
  Child: "Filho(a)",
  Dependent: "Dependente",
};

const emptyPerson = (relationship: QuotePerson["relationship"] = "Self"): QuotePerson => ({
  age: 30,
  dob: null,
  gender: "Male",
  relationship,
  aptcEligible: true,
  usesTobacco: false,
  utilizationLevel: "Medium",
});

const METALS = ["Bronze", "Silver", "Gold", "Platinum"] as const;

const SORTS: Array<{ value: NonNullable<SearchOptions["sort"]>; label: string }> = [
  { value: "premium", label: "Menor prêmio" },
  { value: "deductible", label: "Menor dedutível" },
  { value: "oopc", label: "Menor custo anual" },
  { value: "quality_rating", label: "Melhor avaliação" },
];

/**
 * Ponta A — a corretora monta a cotação.
 *
 * Two steps instead of one dense workspace: define WHO is being quoted, then
 * compare plans. Showing the household form, the plan list and the proposal
 * cart at the same time made every screen look busy; the broker only ever does
 * one of those at a time, so the UI now follows that rhythm.
 */
export function QuoteBuilder() {
  const [step, setStep] = React.useState<"perfil" | "planos">("perfil");
  const [profile, setProfile] = React.useState<QuoteProfile>(() => ({
    zipcode: "33073",
    state: "FL",
    income: 33000,
    year: defaultPlanYear(),
    people: [emptyPerson("Self")],
  }));
  const [plans, setPlans] = React.useState<PlanQuote[] | null>(null);
  const [meta, setMeta] = React.useState<{
    usingFixtures: boolean;
    total: number;
    county: string | null;
    eligibility: EligibilitySummary | null;
  } | null>(null);
  const [sort, setSort] = React.useState<NonNullable<SearchOptions["sort"]>>("premium");
  const [metals, setMetals] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState<PlanOptionDraft[]>([]);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [seed, setSeed] = React.useState<PlanQuote | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CreateQuoteResult | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [copiedMsg, setCopiedMsg] = React.useState(false);
  const [prefill, setPrefill] = React.useState<{ filled: string[]; notes: string[] } | null>(null);
  const [prefilling, setPrefilling] = React.useState(false);

  const patch = (p: Partial<QuoteProfile>) => setProfile((s) => ({ ...s, ...p }));
  const patchPerson = (i: number, p: Partial<QuotePerson>) =>
    setProfile((s) => ({ ...s, people: s.people.map((x, idx) => (idx === i ? { ...x, ...p } : x)) }));
  const addPerson = () =>
    setProfile((s) => ({
      ...s,
      people: [...s.people, emptyPerson(s.people.some((p) => p.relationship === "Spouse") ? "Child" : "Spouse")],
    }));
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
        eligibility: res.eligibility,
      });
      if (res.profile) setProfile((s) => ({ ...s, ...res.profile }));
      setStep("planos");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const rerun = (next: { sort?: NonNullable<SearchOptions["sort"]>; metals?: string[] }) => {
    if (next.sort) setSort(next.sort);
    if (next.metals) setMetals(next.metals);
    void search({
      sort: next.sort ?? sort,
      metalLevels: (next.metals ?? metals).length ? next.metals ?? metals : undefined,
    });
  };

  const inDraft = (planId: string) => draft.some((d) => d.planId === planId);
  const toggle = (p: PlanQuote) =>
    setDraft((d) => (d.some((x) => x.planId === p.planId) ? d.filter((x) => x.planId !== p.planId) : [...d, { ...p }]));
  const removeOption = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));
  const saveOption = (o: PlanQuote) =>
    setDraft((d) => {
      if (editIndex == null) return [...d, { ...o, printUrl: seed ? (seed as PlanOptionDraft).printUrl ?? null : null }];
      const copy = [...d];
      copy[editIndex] = { ...o, printUrl: copy[editIndex]?.printUrl ?? null };
      return copy;
    });

  /**
   * Add a plan from the screenshot the broker already takes today: the image is
   * stored privately and read by Claude, which fills the plan fields so she
   * reviews instead of retypes.
   */
  const addFromPrint = async (file: File) => {
    setExtracting(true);
    setError(null);
    try {
      const { plan, printUrl } = await cotacaoApi.extractFromPrint(file);
      setSeed({ ...plan, printUrl } as PlanQuote);
      setEditIndex(null);
      setEditorOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

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

  const proposalUrl = result ? result.url || `${typeof location !== "undefined" ? location.origin : ""}/proposta/${result.token}` : "";
  const clientMessage = React.useMemo(
    () => (result ? `${buildClientMessage(profile)}\n\n${proposalUrl}` : ""),
    [result, profile, proposalUrl],
  );

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(proposalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyMessage = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(clientMessage);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 1500);
  };

  // ---------------------------------------------------------------- Perfil --
  if (step === "perfil") {
    return (
      <div className="mx-auto max-w-2xl pb-12">
        <h1 className="text-2xl font-semibold tracking-tight">Nova cotação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Diga para quem é e quem entra no plano. O resto vem do Marketplace.
        </p>

        {error ? (
          <div className="mt-5">
            <ErrorState message={error} />
          </div>
        ) : null}

        <section className="mt-8">
          <SectionTitle>Para quem é</SectionTitle>
          <ContactPicker value={{ id: profile.contactId, name: profile.contactName }} onSelect={onPickContact} />
          {prefilling ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Puxando dados do CRM…
            </p>
          ) : prefill ? (
            <div className="mt-2.5 space-y-1 rounded-lg bg-[rgba(21,94,239,0.06)] px-3 py-2.5">
              {prefill.filled.length ? (
                <p className="flex items-start gap-1.5 text-xs text-primary">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Preenchemos do CRM: {prefill.filled.join(" · ")}</span>
                </p>
              ) : null}
              {prefill.notes.map((n) => (
                <p key={n} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{n}</span>
                </p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <SectionTitle>Onde mora e quanto ganha</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="CEP">
              <Input value={profile.zipcode} onChange={(e) => patch({ zipcode: e.target.value })} inputMode="numeric" />
            </Field>
            <Field label="Estado">
              <Input value={profile.state} onChange={(e) => patch({ state: e.target.value.toUpperCase().slice(0, 2) })} />
            </Field>
            <Field label="Renda anual">
              <Input type="number" value={profile.income} onChange={(e) => patch({ income: Number(e.target.value) })} />
            </Field>
            <Field label="Ano do plano">
              <Input type="number" value={profile.year} onChange={(e) => patch({ year: Number(e.target.value) })} />
            </Field>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <SectionTitle className="mb-0">Quem entra no plano</SectionTitle>
            <button
              type="button"
              onClick={addPerson}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <Plus className="h-4 w-4" /> Adicionar pessoa
            </button>
          </div>

          <div className="mt-3 divide-y rounded-xl border">
            {profile.people.map((pers, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 p-3.5">
                <label className="w-[120px]">
                  <FieldLabel>Relação</FieldLabel>
                  <select
                    value={pers.relationship}
                    onChange={(e) => patchPerson(i, { relationship: e.target.value as QuotePerson["relationship"] })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {(Object.keys(RELATIONSHIP_LABEL) as Array<QuotePerson["relationship"]>).map((r) => (
                      <option key={r} value={r}>
                        {RELATIONSHIP_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="w-[92px]">
                  <FieldLabel>Gênero</FieldLabel>
                  <select
                    value={pers.gender}
                    onChange={(e) => patchPerson(i, { gender: e.target.value as QuotePerson["gender"] })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="Male">Masc.</option>
                    <option value="Female">Fem.</option>
                  </select>
                </label>

                <label className="w-[150px]">
                  <FieldLabel>Data de nascimento</FieldLabel>
                  <input
                    type="date"
                    value={pers.dob ?? ""}
                    onChange={(e) => {
                      const dob = e.target.value || null;
                      patchPerson(i, { dob, age: dob ? ageFrom(dob) ?? pers.age : pers.age });
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  />
                </label>

                <label className="w-[72px]">
                  <FieldLabel>Idade</FieldLabel>
                  <input
                    type="number"
                    value={pers.age}
                    disabled={Boolean(pers.dob)}
                    onChange={(e) => patchPerson(i, { age: Number(e.target.value) })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                  />
                </label>

                <label className="flex h-9 items-center gap-1.5 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={pers.usesTobacco}
                    onChange={(e) => patchPerson(i, { usesTobacco: e.target.checked })}
                  />
                  Fuma
                </label>

                {profile.people.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removePerson(i)}
                    aria-label="Remover pessoa"
                    className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Com a <strong className="font-medium text-foreground">data de nascimento</strong>, o Marketplace calcula a
            idade exata na vigência — é o que corrige o preço dos dependentes.
          </p>
        </section>

        <div className="mt-8">
          <Button onClick={() => search()} disabled={searching} className="h-11 w-full text-[15px]">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar planos
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- Planos --
  const familia = profile.people.length === 1 ? "1 pessoa" : `${profile.people.length} pessoas`;

  return (
    <div className="pb-24">
      {/* Resumo do perfil — editável, sem ocupar a tela inteira */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => setStep("perfil")}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Perfil
        </button>
        <p className="text-sm text-muted-foreground">
          {profile.contactName ? <span className="font-medium text-foreground">{profile.contactName} · </span> : null}
          {profile.zipcode}
          {meta?.county ? ` · ${meta.county}/${profile.state}` : ` · ${profile.state}`} · {familia} ·{" "}
          {formatMoneyBR(profile.income)}/ano · {profile.year}
        </p>
        {meta?.usingFixtures ? (
          <span className="rounded-full bg-status-amber-bg px-2.5 py-0.5 text-xs font-medium text-status-amber-fg">
            Dados de exemplo
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {meta?.eligibility ? (
        <div className="mt-4">
          <EligibilityBanner eligibility={meta.eligibility} />
        </div>
      ) : null}

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {plans?.length ?? 0} {plans?.length === 1 ? "plano" : "planos"}
          </h2>
          {plans?.length ? (
            <span className="text-sm text-muted-foreground">
              a partir de <strong className="text-foreground">{formatMoneyBR(minPremio)}</strong>/mês
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {METALS.map((m) => {
            const on = metals.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => rerun({ metals: on ? metals.filter((x) => x !== m) : [...metals, m] })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {m}
              </button>
            );
          })}
          <select
            value={sort}
            onChange={(e) => rerun({ sort: e.target.value as NonNullable<SearchOptions["sort"]> })}
            className="ml-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Ordenar"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Planos */}
      {searching ? (
        <div className="flex items-center justify-center py-28 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consultando o Marketplace…
        </div>
      ) : plans && plans.length ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {plans.map((p) => (
            <PlanCard
              key={p.planId}
              plan={p}
              selected={inDraft(p.planId)}
              best={p.planId === bestId}
              onToggle={() => toggle(p)}
            />
          ))}
        </div>
      ) : (
        <div className="py-28 text-center text-sm text-muted-foreground">
          Nenhum plano para esse perfil e filtros.
        </div>
      )}

      <div className="mt-6">
        <EstimateNote text={LEAO_BRAND.disclaimer} variant="inline" />
      </div>

      {/* Barra de ação — só aparece quando há algo a fazer */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-5 py-3">
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              extracting && "pointer-events-none opacity-60",
            )}
            title="Anexe o print do plano e nós preenchemos os campos"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addFromPrint(f);
                e.target.value = "";
              }}
            />
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {extracting ? "Lendo o print…" : "Adicionar pelo print"}
          </label>

          {draft.length ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {draft.map((o, i) => (
                <span
                  key={o.planId || i}
                  className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full bg-muted py-1 pl-3 pr-1.5 text-sm"
                >
                  <span className="truncate">{o.nomePlano}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditIndex(i);
                      setSeed(null);
                      setEditorOpen(true);
                    }}
                    aria-label="Editar"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    aria-label="Remover"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Escolha os planos que quer propor.</p>
          )}

          <Button onClick={generate} disabled={!draft.length || generating} className="ml-auto h-10">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Gerar proposta
          </Button>
        </div>
      </div>

      {/* Proposta gerada — link + a mensagem pronta para enviar */}
      {result ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 p-4 sm:items-center">
          <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-xl border bg-background p-5 shadow-card-hover">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Check className="h-4 w-4" /> Proposta pronta
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Válida até {new Date(result.expiresAt).toLocaleDateString("pt-BR")}
                  {profile.contactId ? " · contato marcado com cotacao_enviada" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Fechar
              </button>
            </div>

            <p className="mt-4 text-xs font-medium text-muted-foreground">Mensagem para o cliente</p>
            <textarea
              readOnly
              value={clientMessage}
              rows={9}
              className="mt-1.5 w-full resize-none rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={copyMessage} className="h-9">
                {copiedMsg ? <Check className="h-4 w-4" /> : null} {copiedMsg ? "Copiado" : "Copiar mensagem + link"}
              </Button>
              <Button variant="outline" size="sm" onClick={copy} className="h-9">
                {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? "Copiado" : "Só o link"}
              </Button>
              <a href={`/proposta/${result.token}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-9">
                  <ExternalLink className="h-4 w-4" /> Ver proposta
                </Button>
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <OptionEditor
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) setSeed(null);
        }}
        option={editIndex != null ? draft[editIndex] ?? null : seed}
        onSave={saveOption}
      />
    </div>
  );
}

/**
 * Which plan year to quote by default. Open Enrollment opens on Nov 1, so from
 * October onward the broker is selling NEXT year; before that she is almost
 * always working the current year (a Special Enrollment mid-year).
 */
function defaultPlanYear(today = new Date()): number {
  return today.getMonth() >= 9 ? today.getFullYear() + 1 : today.getFullYear();
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("mb-3 text-base font-semibold tracking-tight", className)}>{children}</h2>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-muted-foreground">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}
