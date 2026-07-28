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
  FileImage,
  Send,
} from "lucide-react";
import { api } from "@/lib/client/api";
import { cotacaoApi, type CreateQuoteResult, type SearchOptions } from "@/lib/client/cotacao";
import { LEAO_BRAND } from "@/lib/cotacao/brand";
import { ageFrom } from "@/lib/cotacao/prefill";
import { buildClientMessage } from "@/lib/cotacao/message";
import type { EligibilitySummary } from "@/lib/cms";
import type { Recommendation } from "@/lib/cotacao/recommend";
import type { PlanOptionDraft, PlanQuote, QuotePerson, QuoteProfile } from "@/lib/cotacao/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EstimateNote } from "@/components/cotacao/estimate-note";
import { ContactPicker } from "@/components/cotacao/contact-picker";
import { MemberPicker } from "@/components/cotacao/member-picker";
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
 * The prints ARE the primary path, not a fallback: today she screenshots each
 * plan and sends them on WhatsApp, and until the CMS key arrives that is the
 * only source of real prices. So the default screen is "drop the prints, pick
 * the client, send" — searching the Marketplace is a second, optional route
 * that simply adds plans to the same proposal.
 */
export function QuoteBuilder() {
  const [view, setView] = React.useState<"montar" | "buscar">("montar");
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
    county: string | null;
    eligibility: EligibilitySummary | null;
  } | null>(null);
  const [sort, setSort] = React.useState<NonNullable<SearchOptions["sort"]>>("premium");
  const [metals, setMetals] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState<PlanOptionDraft[]>([]);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [extracting, setExtracting] = React.useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [pasted, setPasted] = React.useState(false);
  const [scanPreview, setScanPreview] = React.useState<string | null>(null);
  const [recommendation, setRecommendation] = React.useState<Recommendation | null>(null);
  const [recommending, setRecommending] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [channel, setChannel] = React.useState<"SMS" | "Email" | "WhatsApp">("SMS");
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

  // "Preencheu → upsert": as the broker fills a linked member's fields, the CRM
  // record converges on what was just typed. Debounced per contact so keystrokes
  // in the date input don't hammer the API; best-effort — a CRM hiccup never
  // interrupts the quote being built.
  const syncTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const queueBasicsSync = (contactId: string, basics: { dateOfBirth?: string; gender?: "male" | "female" }) => {
    if (!basics.dateOfBirth && !basics.gender) return;
    clearTimeout(syncTimers.current[contactId]);
    syncTimers.current[contactId] = setTimeout(() => {
      void api.updateContactBasics(contactId, basics).catch(() => undefined);
    }, 800);
  };
  React.useEffect(() => {
    const timers = syncTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);
  const ghlGender = (g: QuotePerson["gender"]): "male" | "female" => (g === "Male" ? "male" : "female");
  const addPerson = () =>
    setProfile((s) => ({
      ...s,
      people: [...s.people, emptyPerson(s.people.some((p) => p.relationship === "Spouse") ? "Child" : "Spouse")],
    }));
  const removePerson = (i: number) => setProfile((s) => ({ ...s, people: s.people.filter((_, idx) => idx !== i) }));

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

  /**
   * Drop the prints she already takes. Each screenshot is read and added to the
   * proposal directly — she reviews the cards instead of filling a form per
   * plan. One bad print never blocks the rest of the batch.
   */
  const addFromPrints = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setError(null);
    setExtracting({ done: 0, total: images.length });

    const failures: string[] = [];
    for (const [i, file] of images.entries()) {
      // Show the print being read, with the scan beam running over it.
      const preview = URL.createObjectURL(file);
      setScanPreview(preview);
      try {
        const { plan, printUrl } = await cotacaoApi.extractFromPrint(file);
        setDraft((d) => [...d, { ...plan, printUrl }]);
      } catch (e) {
        failures.push(`${file.name}: ${(e as Error).message}`);
      } finally {
        URL.revokeObjectURL(preview);
      }
      setExtracting({ done: i + 1, total: images.length });
    }

    setScanPreview(null);
    setExtracting(null);
    if (failures.length) setError(`Não consegui ler ${failures.length} print(s). ${failures.join(" · ")}`);
  };

  /**
   * Paste a print straight from the clipboard (Ctrl/⌘+V) — the broker screenshots
   * a plan and pastes it without ever saving a file. Listens on the document so
   * it works wherever the cursor is, except while typing in a field.
   */
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const images = Array.from(e.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);

      if (!images.length) return;
      e.preventDefault();
      setPasted(true);
      setTimeout(() => setPasted(false), 1800);
      void addFromPrints(images);
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // addFromPrints only closes over setState functions, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (override?: Partial<SearchOptions>) => {
    setSearching(true);
    setError(null);
    try {
      const res = await cotacaoApi.search(profile, {
        sort,
        metalLevels: metals.length ? metals : undefined,
        ...override,
      });
      setPlans(res.plans);
      setMeta({ usingFixtures: res.usingFixtures, county: res.county, eligibility: res.eligibility });
      if (res.profile) setProfile((s) => ({ ...s, ...res.profile }));
      setView("buscar");
    } catch (e) {
      setError((e as Error).message);
      setView("montar");
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
      if (editIndex == null) return [...d, { ...o, printUrl: null }];
      const copy = [...d];
      copy[editIndex] = { ...o, printUrl: copy[editIndex]?.printUrl ?? null };
      return copy;
    });

  /** Ask which plan to present. Advisory only — the broker accepts or ignores it. */
  const askRecommendation = async () => {
    if (!draft.length) return;
    setRecommending(true);
    setError(null);
    try {
      setRecommendation(await cotacaoApi.recommend(profile, draft));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRecommending(false);
    }
  };

  const generate = async () => {
    if (!draft.length) return;
    setGenerating(true);
    setError(null);
    try {
      setResult(await cotacaoApi.create(profile, draft, recommendation?.planId ?? null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  /** Send the proposal to the lead on the CRM's own channel. */
  const sendToLead = async () => {
    if (!result || !profile.contactId) return;
    setSending(true);
    setError(null);
    try {
      await cotacaoApi.sendToLead(profile.contactId, clientMessage, channel);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const proposalUrl = result
    ? result.url || `${typeof location !== "undefined" ? location.origin : ""}/proposta/${result.token}`
    : "";
  const clientMessage = React.useMemo(
    () => (result ? `${buildClientMessage(profile)}\n\n${proposalUrl}` : ""),
    [result, profile, proposalUrl],
  );

  const copy = async () => {
    await navigator.clipboard.writeText(proposalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const copyMessage = async () => {
    await navigator.clipboard.writeText(clientMessage);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 1500);
  };

  const minPremio = plans?.length ? Math.min(...plans.map((p) => p.premioMensal)) : 0;
  const bestId = plans?.find((p) => p.premioMensal === minPremio)?.planId;

  // ------------------------------------------------- Buscar no Marketplace --
  if (view === "buscar") {
    return (
      <div key="buscar" className="animate-fade-up pb-24">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={() => setView("montar")}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar à proposta
          </button>
          <p className="text-sm text-muted-foreground">
            {profile.zipcode}
            {meta?.county ? ` · ${meta.county}/${profile.state}` : ` · ${profile.state}`} ·{" "}
            {profile.people.length === 1 ? "1 pessoa" : `${profile.people.length} pessoas`} ·{" "}
            {formatMoneyBR(profile.income)}/ano · {profile.year}
          </p>
          {meta?.usingFixtures ? (
            <span className="rounded-full bg-status-amber-bg px-2.5 py-0.5 text-xs font-medium text-status-amber-fg">
              Dados de exemplo · sem chave do CMS
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

        {searching ? (
          <div className="flex items-center justify-center py-28 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consultando o Marketplace…
          </div>
        ) : plans && plans.length ? (
          <div className="stagger mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
          <div className="py-28 text-center text-sm text-muted-foreground">Nenhum plano para esse perfil.</div>
        )}

        <BottomBar count={draft.length} generating={generating} onGenerate={generate} onBack={() => setView("montar")} />
      </div>
    );
  }

  // -------------------------------------------------------- Montar (print) --
  const busy = extracting !== null;

  return (
    <div key="montar" className="animate-fade-up pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Nova cotação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha o cliente, solte os prints dos planos e gere a proposta.
          </p>
        </div>
        <Button variant="outline" onClick={() => search()} disabled={searching} className="h-10">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar no Marketplace
        </Button>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {/* Cliente + dados da mensagem, lado a lado, ocupando a largura */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        <section className="rounded-[var(--radius)] bg-card p-5 shadow-raise ring-1 ring-border">
          <SectionTitle>Cliente</SectionTitle>
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

        <section className="rounded-[var(--radius)] bg-card p-5 shadow-raise ring-1 ring-border">
          <div className="flex items-baseline justify-between">
            <SectionTitle className="mb-0">Dados da cotação</SectionTitle>
            <span className="text-xs text-muted-foreground">Usados na mensagem enviada ao cliente</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

          <div className="mt-4 flex items-baseline justify-between">
            <p className="text-sm font-medium">Quem entra no plano</p>
            <button
              type="button"
              onClick={addPerson}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <Plus className="h-4 w-4" /> Adicionar pessoa
            </button>
          </div>
          <div className="mt-2 divide-y rounded-xl border">
            {profile.people.map((pers, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 p-3">
                <label className="w-[118px]">
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
                  {/* Gênero sincroniza na criação do contato — o PUT do GHL não aceita o campo. */}
                  <select
                    value={pers.gender}
                    onChange={(e) => patchPerson(i, { gender: e.target.value as QuotePerson["gender"] })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="Male">Masc.</option>
                    <option value="Female">Fem.</option>
                  </select>
                </label>
                <label className="w-[148px]">
                  <FieldLabel>Nascimento</FieldLabel>
                  <input
                    type="date"
                    value={pers.dob ?? ""}
                    onChange={(e) => {
                      const dob = e.target.value || null;
                      patchPerson(i, { dob, age: dob ? ageFrom(dob) ?? pers.age : pers.age });
                      if (pers.contactId && dob) queueBasicsSync(pers.contactId, { dateOfBirth: dob });
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
                <div className="flex h-9 items-center">
                  <MemberPicker
                    value={{ id: pers.contactId, name: pers.contactName }}
                    defaults={{ dateOfBirth: pers.dob, gender: ghlGender(pers.gender) }}
                    onSelect={(m) => {
                      if (!m) {
                        patchPerson(i, { contactId: null, contactName: null });
                        return;
                      }
                      // O CRM manda a data de nascimento? Preenche — preço exato.
                      const raw = m.dateOfBirth;
                      const dob = raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : pers.dob;
                      patchPerson(i, {
                        contactId: m.id,
                        contactName: m.name,
                        dob: dob ?? null,
                        age: dob ? ageFrom(dob) ?? pers.age : pers.age,
                      });
                      // A linha tem a data que o CRM não tem? Upsert — o contato
                      // converge para o que a corretora acabou de preencher.
                      if (!raw && pers.dob) {
                        queueBasicsSync(m.id, { dateOfBirth: pers.dob, gender: ghlGender(pers.gender) });
                      }
                    }}
                  />
                </div>
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
        </section>
      </div>

      {/* Planos da proposta — o coração da tela */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Planos da proposta{draft.length ? ` · ${draft.length}` : ""}
          </h2>
          <button
            type="button"
            onClick={() => {
              setEditIndex(null);
              setEditorOpen(true);
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Adicionar manualmente
          </button>
        </div>

        {/* Dropzone dos prints — arrastar, clicar ou colar (Ctrl+V) */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFromPrints(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "group/drop relative mt-4 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[var(--radius)] border-2 border-dashed px-6 py-10 text-center transition-all duration-200",
            dragging
              ? "scale-[1.005] border-accent bg-accent-soft shadow-raise"
              : "border-input bg-card/60 hover:border-primary/40 hover:bg-card hover:shadow-raise",
            busy && "pointer-events-none opacity-80",
          )}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              void addFromPrints(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          {busy ? (
            <>
              {/* O print em leitura, com o feixe de escaneamento passando por cima */}
              <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-foreground/[0.03] ring-1 ring-primary/25">
                {scanPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={scanPreview} alt="Print em leitura" className="max-h-44 w-full object-cover object-top" />
                ) : (
                  <div className="h-32 w-full animate-pulse bg-muted" />
                )}
                <span
                  className="animate-scan absolute inset-x-0 top-0 h-1/3"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(37,99,235,0) 0%, rgba(37,99,235,0.22) 45%, rgba(37,99,235,0.45) 50%, rgba(37,99,235,0.22) 55%, rgba(37,99,235,0) 100%)",
                  }}
                  aria-hidden
                />
                <span className="absolute inset-0 ring-2 ring-inset ring-primary/20" aria-hidden />
              </div>
              <p className="mt-4 flex items-center gap-2 font-display text-base font-semibold tracking-tight">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Lendo as informações do print… {extracting!.done + 1 > extracting!.total ? extracting!.total : extracting!.done + 1}/
                {extracting!.total}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Seguradora, plano, valores e coberturas</p>
              <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.round((extracting!.done / extracting!.total) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200",
                  dragging
                    ? "scale-110 bg-accent/15 text-accent"
                    : "bg-primary/8 text-primary group-hover/drop:scale-105 group-hover/drop:bg-primary/12",
                )}
              >
                <ImagePlus className="h-6 w-6" />
              </span>
              <p className="mt-3 font-display text-base font-semibold tracking-tight">
                {dragging ? "Solte para adicionar" : "Arraste os prints dos planos aqui"}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Lemos o print e preenchemos os campos — você só confere.
              </p>
              <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-1 font-medium">clique para escolher</span>
                <span>ou cole com</span>
                <kbd className="rounded-md bg-muted px-1.5 py-1 font-sans font-semibold text-foreground">Ctrl</kbd>
                <span>+</span>
                <kbd className="rounded-md bg-muted px-1.5 py-1 font-sans font-semibold text-foreground">V</kbd>
              </p>
            </>
          )}
        </label>

        {pasted ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> Print colado
          </p>
        ) : null}

        {draft.length ? (
          <div className="stagger mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {draft.map((o, i) => (
              <div key={o.planId || i} className="group/opt flex flex-col gap-2">
                <div className="transition-transform duration-200 group-hover/opt:-translate-y-1">
                  <PlanCard plan={o} readOnly printUrl={o.printUrl} />
                </div>
                <div className="flex items-center gap-2 text-xs opacity-70 transition-opacity duration-200 group-hover/opt:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditIndex(i);
                      setEditorOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Revisar
                  </button>
                  {o.printUrl ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <FileImage className="h-3.5 w-3.5" /> print anexado
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-status-red-bg hover:text-status-red-fg"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Sugestão da IA — a corretora decide se usa */}
        {draft.length >= 1 ? (
          <div className="mt-5">
            {recommendation ? (
              <div className="overflow-hidden rounded-[var(--radius)] bg-card shadow-raise ring-1 ring-primary/25">
                <div className="flex items-center gap-2 bg-primary/[0.06] px-5 py-2.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sugestão para apresentar</p>
                  <button
                    type="button"
                    onClick={() => setRecommendation(null)}
                    className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Descartar
                  </button>
                </div>
                <div className="p-5">
                  <p className="font-display text-lg font-semibold tracking-tight">{recommendation.titulo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {draft.find((d) => d.planId === recommendation.planId)?.nomePlano ?? "—"}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed">{recommendation.motivo}</p>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {recommendation.pontos.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0E9F6E]" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  {recommendation.alerta ? (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-status-amber-bg px-3 py-2 text-xs text-status-amber-fg">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{recommendation.alerta}</span>
                    </p>
                  ) : null}
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Sugestão gerada por IA a partir das opções escolhidas — confira antes de apresentar.
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={askRecommendation}
                disabled={recommending}
                className="group/ai inline-flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 text-sm font-medium shadow-raise ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-raise-lg disabled:translate-y-0 disabled:opacity-70"
              >
                {recommending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary transition-transform group-hover/ai:scale-110" />
                )}
                {recommending ? "Analisando as opções…" : "Sugerir a melhor opção para este cliente"}
              </button>
            )}
          </div>
        ) : null}

        <div className="mt-5">
          <EstimateNote text={LEAO_BRAND.disclaimer} variant="inline" />
        </div>
      </section>

      <BottomBar count={draft.length} generating={generating} onGenerate={generate} />

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

            {/* Enviar direto ao lead pelo GHL */}
            {profile.contactId ? (
              <div className="mt-3 rounded-lg bg-primary/[0.05] p-3 ring-1 ring-primary/15">
                {sent ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-[#0E9F6E]">
                    <Check className="h-4 w-4" /> Enviada para {profile.contactName} por {channel}
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-medium">
                      Enviar direto para <strong>{profile.contactName}</strong> pelo GHL
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as typeof channel)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        aria-label="Canal de envio"
                      >
                        <option value="SMS">SMS</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Email">E-mail</option>
                      </select>
                      <Button size="sm" onClick={sendToLead} disabled={sending} className="h-9">
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {sending ? "Enviando…" : "Enviar cotação ao lead"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Vincule um contato para enviar direto pelo GHL e registrar a cotação nas notas do lead.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyMessage} className="h-9">
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
        onOpenChange={setEditorOpen}
        option={editIndex != null ? draft[editIndex] ?? null : null}
        onSave={saveOption}
      />
    </div>
  );
}

function BottomBar({
  count,
  generating,
  onGenerate,
  onBack,
}: {
  count: number;
  generating: boolean;
  onGenerate: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/85 shadow-[0_-8px_24px_-16px_rgb(20_32_58/0.35)] backdrop-blur-md">
      <div className="flex w-full items-center gap-3 px-6 py-3.5">
        <p className="text-sm text-muted-foreground">
          {count ? (
            <>
              <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
                {count}
              </span>
              {count === 1 ? "plano na proposta" : "planos na proposta"}
            </>
          ) : (
            "Adicione ao menos um plano para gerar a proposta."
          )}
        </p>
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack} className="h-10">
            Voltar à proposta
          </Button>
        ) : null}
        <Button
          onClick={onGenerate}
          disabled={!count || generating}
          className="ml-auto h-11 px-5 text-[15px] shadow-raise transition-all hover:-translate-y-0.5 hover:shadow-raise-lg disabled:translate-y-0 disabled:shadow-none"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Gerar proposta
        </Button>
      </div>
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
