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
  FileText,
  Send,
} from "lucide-react";
import { api } from "@/lib/client/api";
import { cotacaoApi, type CreateQuoteResult, type SearchOptions, type SendChannelResult } from "@/lib/client/cotacao";
import { LEAO_BRAND } from "@/lib/cotacao/brand";
import { IDIOMAS, type Idioma } from "@/lib/cotacao/i18n";
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
import { metalStyle } from "@/lib/cotacao/metal";
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

/* Type/anatomy do formulário — um só lugar, para a UI sair uniforme:
   colunas do household, cabeçalho de tabela e o estilo base de select/input. */
const PEOPLE_GRID = "grid-cols-[150px_130px_160px_84px_80px_minmax(200px,1fr)_44px]";
const TH = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const SELECT =
  "h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

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
    idioma: "pt",
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
  /** Per-channel outcome of the dispatch — null enquanto não enviou. */
  const [sent, setSent] = React.useState<SendChannelResult[] | null>(null);
  // Ela escolhe um canal ou os dois: quem responde no WhatsApp responde no
  // WhatsApp, mas o e-mail é o que fica guardado — mandar nos dois é comum.
  const [channels, setChannels] = React.useState<Array<"WhatsApp" | "Email">>(["WhatsApp"]);
  // The lead's real phone/e-mail, read when the proposal is ready — so the
  // dispatch shows where it will land and can fill a missing field on the spot.
  const [dest, setDest] = React.useState<{ phone?: string | null; email?: string | null } | null>(null);
  const [phoneInput, setPhoneInput] = React.useState("");
  const [emailInput, setEmailInput] = React.useState("");
  const [savingDest, setSavingDest] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [pdfDone, setPdfDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CreateQuoteResult | null>(null);
  /** O painel de entrega está aberto? Separado de `result` porque gerar o PDF
   *  também cria a cotação, e não deve abrir o painel por tabela. */
  const [panelOpen, setPanelOpen] = React.useState(false);
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

  /*
   * O "flow": ao escolher um plano, uma ficha sai do card e viaja até o contador
   * da barra inferior, que pulsa ao receber. É o que transforma "a borda mudou de
   * cor" em "o plano entrou na proposta" — a corretora acompanha a montagem sem
   * precisar procurar o número no rodapé.
   */
  const counterRef = React.useRef<HTMLSpanElement>(null);
  const [flights, setFlights] = React.useState<Flight[]>([]);
  const [bump, setBump] = React.useState(0);
  const flightId = React.useRef(0);

  const flyToCounter = (p: PlanQuote, from?: DOMRect) => {
    const to = counterRef.current?.getBoundingClientRect();
    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Sem origem, sem destino ou com movimento reduzido: só o pulso do contador.
    if (!from || !to || reduced) {
      setBump((b) => b + 1);
      return;
    }
    const id = ++flightId.current;
    setFlights((f) => [...f, { id, plan: p, from, to }]);
    window.setTimeout(() => {
      setFlights((f) => f.filter((x) => x.id !== id));
      setBump((b) => b + 1);
    }, 640);
  };

  const inDraft = (planId: string) => draft.some((d) => d.planId === planId);
  /** Posição do plano na proposta (1-based) — o mesmo número do card e do PDF. */
  const draftOrder = (planId: string) => {
    const i = draft.findIndex((d) => d.planId === planId);
    return i < 0 ? null : i + 1;
  };

  const toggle = (p: PlanQuote, from?: DOMRect) => {
    const adding = !inDraft(p.planId);
    setDraft((d) => (d.some((x) => x.planId === p.planId) ? d.filter((x) => x.planId !== p.planId) : [...d, { ...p }]));
    if (adding) flyToCounter(p, from);
  };
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

  /**
   * A cotação persistida — criada sob demanda.
   *
   * Gerar o PDF e enviar ao cliente precisam de uma cotação salva (é dela que
   * saem o link, o token e o PDF). Antes isso obrigava a corretora a clicar
   * "Gerar proposta" primeiro; agora qualquer uma das duas ações cria a cotação
   * se ainda não existir, e reaproveita a que existe se já existir.
   */
  const ensureQuote = async (): Promise<CreateQuoteResult | null> => {
    if (result) return result;
    if (!draft.length) {
      setError("Adicione ao menos um plano à proposta.");
      return null;
    }
    const created = await cotacaoApi.create(profile, draft, recommendation?.planId ?? null);
    setResult(created);
    setSent(null);
    return created;
  };

  /** Nome do arquivo que o servidor escolheu (varia com o idioma). */
  const filenameFrom = (res: Response, fallback: string) => {
    const m = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "");
    return m?.[1] || fallback;
  };

  /**
   * Gera e baixa o PDF da proposta — dados do cliente, opções e idioma.
   *
   * Baixamos via blob em vez de abrir a URL numa aba: o app roda dentro de um
   * iframe do GHL, onde abrir aba nova é bloqueado com frequência e a corretora
   * ficaria olhando um botão que não faz nada.
   */
  const generatePdf = async () => {
    setPdfBusy(true);
    setError(null);
    try {
      const quote = await ensureQuote();
      if (!quote) return;
      const res = await fetch(cotacaoApi.pdfUrl(quote.id, profile.idioma));
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Não foi possível gerar o PDF.");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filenameFrom(res, `proposta-${profile.year}.pdf`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setPdfDone(true);
      setTimeout(() => URL.revokeObjectURL(href), 5000);
      setTimeout(() => setPdfDone(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPdfBusy(false);
    }
  };

  /** Abre o painel de entrega — criando a cotação antes, se preciso. */
  const openSend = async () => {
    setGenerating(true);
    setError(null);
    try {
      if (await ensureQuote()) setPanelOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const generate = openSend;

  /*
   * Mexeu nos planos, a cotação salva não vale mais: o link e o PDF apontariam
   * para uma lista que não é a da tela. Descartamos o resultado para que a
   * próxima ação emita uma cotação nova, com os planos atuais.
   */
  React.useEffect(() => {
    setResult(null);
    setPanelOpen(false);
    setSent(null);
  }, [draft]);

  // Read where the proposal will land (phone for WhatsApp, e-mail for e-mail).
  React.useEffect(() => {
    if (!result || !profile.contactId) return;
    setDest(null);
    setPhoneInput("");
    setEmailInput("");
    api
      .contact(profile.contactId)
      .then((c) => setDest({ phone: c.phone, email: c.email }))
      .catch(() => setDest({}));
  }, [result, profile.contactId]);

  const wantsWhats = channels.includes("WhatsApp");
  const wantsEmail = channels.includes("Email");
  const missingPhone = dest !== null && wantsWhats && !dest.phone;
  const missingEmail = dest !== null && wantsEmail && !dest.email;
  const toggleChannel = (c: "WhatsApp" | "Email") =>
    // Nunca deixa ficar sem canal nenhum: o último selecionado não desmarca.
    setChannels((s) => (s.includes(c) ? (s.length === 1 ? s : s.filter((x) => x !== c)) : [...s, c]));

  const channelLabel = (list: Array<"WhatsApp" | "Email">) =>
    list.map((c) => (c === "Email" ? "e-mail" : "WhatsApp")).join(" e ");

  /** Send the proposal to the lead on the CRM's own channels (um ou os dois). */
  const sendToLead = async () => {
    if (!result || !profile.contactId) return;
    setSending(true);
    setError(null);
    try {
      // Missing the field a channel needs? Save it to the contact first
      // (upsert), so next time it's already there — then send.
      const basics: { phone?: string; email?: string } = {};
      if (missingPhone) {
        const v = phoneInput.trim();
        if (!v) {
          setError("Informe o telefone do contato.");
          setSending(false);
          return;
        }
        basics.phone = v;
      }
      if (missingEmail) {
        const v = emailInput.trim();
        if (!v) {
          setError("Informe o e-mail do contato.");
          setSending(false);
          return;
        }
        basics.email = v;
      }
      if (basics.phone || basics.email) {
        setSavingDest(true);
        await api.updateContactBasics(profile.contactId, basics);
        setDest((d) => ({ ...d, ...basics }));
        setSavingDest(false);
      }

      const res = await cotacaoApi.sendToLead({
        contactId: profile.contactId,
        message: clientMessage,
        channels,
        idioma: profile.idioma,
        proposalUrl,
        profile: { contactName: profile.contactName, year: profile.year },
        // O PDF da proposta vai anexado — é o que a cliente abre no WhatsApp.
        quoteId: result.id,
        attachPdf: true,
      });
      setSent(res.results);
      // Um canal pode falhar sem derrubar o outro — e o PDF nunca derruba o envio.
      const failed = res.results.filter((r) => !r.ok);
      if (failed.length) {
        setError(failed.map((r) => `Falhou no ${channelLabel([r.channel])}: ${r.error}`).join(" · "));
      } else if (res.pdfError) {
        setError(`Mensagem enviada, mas sem o PDF: ${res.pdfError}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
      setSavingDest(false);
    }
  };

  // O servidor só monta a URL absoluta quando NEXT_PUBLIC_APP_URL existe; sem
  // ela vem um caminho relativo, que não serve nem para o e-mail nem para o
  // WhatsApp. Aqui completamos com a origem real do navegador.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const proposalUrl = result
    ? /^https?:\/\//.test(result.url || "")
      ? result.url
      : `${origin}/proposta/${result.token}`
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

  /**
   * As duas ações de saída, no canto direito das duas telas: gerar o PDF e
   * enviar ao cliente. O idioma anda junto porque é ele que decide a língua das
   * três peças que saem daqui — a mensagem, o e-mail e o próprio PDF.
   *
   * Nenhuma delas exige "Gerar proposta" antes: a cotação é criada por baixo se
   * ainda não existir (ver ensureQuote).
   */
  const empty = draft.length === 0;
  const deliveryActions = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        Idioma
        <select
          value={profile.idioma ?? "pt"}
          aria-label="Idioma do material do cliente"
          onChange={(e) => patch({ idioma: e.target.value as Idioma })}
          className="h-10 rounded-md border border-input bg-background px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {IDIOMAS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </label>

      <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />

      <Button
        variant="outline"
        onClick={generatePdf}
        disabled={empty || pdfBusy}
        title={empty ? "Adicione ao menos um plano à proposta." : "Baixar o PDF da proposta"}
        className="h-10 border-primary/45 text-primary hover:bg-primary/10 hover:text-primary"
      >
        {pdfBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : pdfDone ? (
          <Check className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {pdfBusy ? "Gerando…" : pdfDone ? "PDF baixado" : "Gerar PDF"}
      </Button>

      <Button
        onClick={openSend}
        disabled={empty || generating}
        title={empty ? "Adicione ao menos um plano à proposta." : "Enviar a proposta ao cliente"}
        className="h-10"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar ao cliente
      </Button>
    </div>
  );

  /**
   * O painel de entrega da proposta. Vive fora dos dois `return` porque a
   * cotação pode ser gerada tanto na tela de montar quanto na do Marketplace —
   * e nos dois casos ela precisa das mesmas ações: enviar (WhatsApp e/ou
   * e-mail) e gerar o PDF.
   */
  const resultModal = result && panelOpen ? (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/25 p-4 sm:items-center">
      <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-lg border bg-background p-5 shadow-card-hover">
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
            onClick={() => setPanelOpen(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">Mensagem para o cliente</p>
          {/* O idioma vale para a mensagem, o e-mail e o PDF — só o material do
              cliente muda; a tela da corretora segue em português. */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Idioma
            <select
              value={profile.idioma ?? "pt"}
              aria-label="Idioma do material do cliente"
              onChange={(e) => patch({ idioma: e.target.value as Idioma })}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground"
            >
              {IDIOMAS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          readOnly
          value={clientMessage}
          rows={9}
          className="mt-1.5 w-full resize-none rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed"
        />

        {/* Enviar direto ao lead pelo GHL */}
        {profile.contactId ? (
          <div className="mt-3 rounded-lg border p-3">
            {sent?.some((r) => r.ok) ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-status-green-fg">
                <Check className="h-4 w-4" /> Enviada para {profile.contactName} por{" "}
                {channelLabel(sent.filter((r) => r.ok).map((r) => r.channel))}
              </p>
            ) : (
              <>
                <p className="text-xs font-medium">
                  Enviar direto para <strong>{profile.contactName}</strong> pelo GHL
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["WhatsApp", "Email"] as const).map((c) => {
                    const on = channels.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleChannel(c)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                          )}
                        >
                          {on ? <Check className="h-3 w-3" /> : null}
                        </span>
                        {c === "Email" ? "E-mail" : "WhatsApp"}
                      </button>
                    );
                  })}
                </div>

                {/* Onde vai cair — e, se faltar o dado, preenche na hora (upsert). */}
                <div className="mt-2 space-y-2">
                  {wantsWhats ? (
                    missingPhone ? (
                      <div>
                        <input
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          type="tel"
                          placeholder="+1 305 555 0100"
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                        />
                        <p className="mt-1 flex items-start gap-1 text-xs leading-snug text-muted-foreground">
                          <Info className="mt-px h-3 w-3 shrink-0" />
                          O contato não tem telefone. Salvamos no CRM ao enviar.
                        </p>
                      </div>
                    ) : dest?.phone ? (
                      <p className="text-xs text-muted-foreground">
                        WhatsApp para <span className="font-medium text-foreground">{dest.phone}</span>
                      </p>
                    ) : null
                  ) : null}

                  {wantsEmail ? (
                    missingEmail ? (
                      <div>
                        <input
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          type="email"
                          placeholder="email@cliente.com"
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                        />
                        <p className="mt-1 flex items-start gap-1 text-xs leading-snug text-muted-foreground">
                          <Info className="mt-px h-3 w-3 shrink-0" />
                          O contato não tem e-mail. Salvamos no CRM ao enviar.
                        </p>
                      </div>
                    ) : dest?.email ? (
                      <p className="text-xs text-muted-foreground">
                        E-mail para <span className="font-medium text-foreground">{dest.email}</span>
                      </p>
                    ) : null
                  ) : null}
                </div>

                <Button size="sm" onClick={sendToLead} disabled={sending || dest === null} className="mt-2 h-9 w-full">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {savingDest
                    ? "Salvando contato…"
                    : sending
                      ? "Enviando…"
                      : missingPhone || missingEmail
                        ? `Salvar e enviar por ${channelLabel(channels)}`
                        : `Enviar por ${channelLabel(channels)}`}
                </Button>
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
          <Button variant="outline" size="sm" onClick={generatePdf} disabled={pdfBusy} className="h-9">
            {pdfBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : pdfDone ? (
              <Check className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {pdfBusy ? "Gerando…" : pdfDone ? "PDF baixado" : "Gerar PDF da proposta"}
          </Button>
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
  ) : null;

  const minPremio = plans?.length ? Math.min(...plans.map((p) => p.premioMensal)) : 0;
  const bestId = plans?.find((p) => p.premioMensal === minPremio)?.planId;

  // ------------------------------------------------- Buscar no Marketplace --
  if (view === "buscar") {
    return (
      <div key="buscar" className="pb-20">
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
          {/* As mesmas saídas da tela de montar, no canto direito também aqui. */}
          <div className="ml-auto">{deliveryActions}</div>
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b pb-2.5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold tracking-tight">
              {plans?.length ?? 0} {plans?.length === 1 ? "plano" : "planos"}
            </h2>
            {plans?.length ? (
              <span className="text-sm text-muted-foreground">
                a partir de <strong className="text-foreground">{formatMoneyBR(minPremio)}</strong>/mês
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* O filtro de tier carrega a cor do próprio metal quando ativo —
                a cor É a informação, não um enfeite. */}
            {METALS.map((m) => {
              const on = metals.includes(m);
              const style = metalStyle(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => rerun({ metals: on ? metals.filter((x) => x !== m) : [...metals, m] })}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    on ? style.chip : "text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted hover:text-foreground",
                  )}
                >
                  {style.label}
                </button>
              );
            })}
            <select
              value={sort}
              onChange={(e) => rerun({ sort: e.target.value as NonNullable<SearchOptions["sort"]> })}
              className="ml-1 h-10 rounded-md border border-input bg-background px-2.5 text-sm shadow-sm"
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
          <div className="stagger mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {plans.map((p) => (
              <PlanCard
                key={p.planId}
                plan={p}
                selected={inDraft(p.planId)}
                order={draftOrder(p.planId)}
                best={p.planId === bestId}
                onToggle={(rect) => toggle(p, rect)}
              />
            ))}
          </div>
        ) : (
          <div className="py-28 text-center text-sm text-muted-foreground">Nenhum plano para esse perfil.</div>
        )}

        <BottomBar
          count={draft.length}
          generating={generating}
          onGenerate={generate}
          onBack={() => setView("montar")}
          counterRef={counterRef}
          bump={bump}
        />

        {/* As fichas em voo — do card escolhido até o contador */}
        {flights.map((f) => (
          <FlyChip key={f.id} flight={f} />
        ))}

        {/* A proposta pode nascer aqui também — mesmas ações da tela de montar. */}
        {resultModal}
      </div>
    );
  }

  // -------------------------------------------------------- Montar (print) --
  const busy = extracting !== null;

  return (
    // A tela ocupa a altura visível do frame (o GHL define quanto é): o card dos
    // planos estica para o fim, em vez de deixar um vazio embaixo.
    <div key="montar" className="flex min-h-[calc(100dvh-var(--shell-chrome))] flex-col pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Nova cotação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha o cliente, solte os prints dos planos e gere a proposta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => search()} disabled={searching} className="h-10">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar no Marketplace
          </Button>
          {deliveryActions}
        </div>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {/* Um único card de dados — cliente, perfil e household juntos. As larguras
          das colunas vêm do conteúdo (cliente largo, CEP/UF curtos), para a UI
          guiar o preenchimento em vez de espalhar campos soltos. */}
      <section className="mt-5 rounded-lg border bg-card shadow-card">
        <div className="border-b px-5 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4 xl:grid-cols-[minmax(300px,1.6fr)_minmax(130px,1fr)_minmax(90px,0.7fr)_minmax(150px,1fr)_minmax(120px,0.9fr)]">
            <div className="col-span-2 md:col-span-4 xl:col-span-1">
              <FieldLabel>Cliente</FieldLabel>
              <ContactPicker value={{ id: profile.contactId, name: profile.contactName }} onSelect={onPickContact} />
            </div>
            <Field label="CEP">
              <Input
                className="h-10"
                value={profile.zipcode}
                onChange={(e) => patch({ zipcode: e.target.value })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Estado">
              <Input
                className="h-10"
                value={profile.state}
                onChange={(e) => patch({ state: e.target.value.toUpperCase().slice(0, 2) })}
              />
            </Field>
            <Field label="Renda anual (USD)">
              <Input
                className="h-10"
                type="number"
                value={profile.income}
                onChange={(e) => patch({ income: Number(e.target.value) })}
              />
            </Field>
            <Field label="Ano do plano">
              <Input
                className="h-10"
                type="number"
                value={profile.year}
                onChange={(e) => patch({ year: Number(e.target.value) })}
              />
            </Field>
          </div>
          {prefilling ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Puxando dados do CRM…
            </p>
          ) : prefill ? (
            <div className="mt-3 space-y-1 rounded-md bg-status-blue-bg px-3 py-2.5">
              {prefill.filled.length ? (
                <p className="flex items-start gap-1.5 text-xs text-status-blue-fg">
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
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Quem entra no plano</h2>
            <button
              type="button"
              onClick={addPerson}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-card transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" /> Adicionar pessoa
            </button>
          </div>

          {/* Tabela do household: cabeçalho único no lugar de labels repetidos
              por linha — cada coluna com a largura do seu conteúdo. */}
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[880px] overflow-hidden rounded-lg border">
              <div className={cn("grid items-center gap-x-3 border-b bg-muted/50 px-3 py-2", PEOPLE_GRID)}>
                <span className={TH}>Relação</span>
                <span className={TH}>Gênero</span>
                <span className={TH}>Nascimento</span>
                <span className={TH}>Idade</span>
                <span className={cn(TH, "text-center")}>Fumante</span>
                <span className={TH}>Contato no CRM</span>
                <span aria-hidden />
              </div>
              <div className="divide-y">
                {profile.people.map((pers, i) => (
                  <div key={i} className={cn("grid items-center gap-x-3 px-3 py-2.5", PEOPLE_GRID)}>
                    <select
                      value={pers.relationship}
                      aria-label="Relação"
                      onChange={(e) => patchPerson(i, { relationship: e.target.value as QuotePerson["relationship"] })}
                      className={SELECT}
                    >
                      {(Object.keys(RELATIONSHIP_LABEL) as Array<QuotePerson["relationship"]>).map((r) => (
                        <option key={r} value={r}>
                          {RELATIONSHIP_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    {/* Gênero sincroniza na criação do contato — o PUT do GHL não aceita o campo. */}
                    <select
                      value={pers.gender}
                      aria-label="Gênero"
                      onChange={(e) => patchPerson(i, { gender: e.target.value as QuotePerson["gender"] })}
                      className={SELECT}
                    >
                      <option value="Male">Masculino</option>
                      <option value="Female">Feminino</option>
                    </select>
                    <input
                      type="date"
                      aria-label="Nascimento"
                      value={pers.dob ?? ""}
                      onChange={(e) => {
                        const dob = e.target.value || null;
                        patchPerson(i, { dob, age: dob ? ageFrom(dob) ?? pers.age : pers.age });
                        if (pers.contactId && dob) queueBasicsSync(pers.contactId, { dateOfBirth: dob });
                      }}
                      className={SELECT}
                    />
                    <input
                      type="number"
                      aria-label="Idade"
                      value={pers.age}
                      disabled={Boolean(pers.dob)}
                      title={pers.dob ? "Calculada pelo nascimento" : undefined}
                      onChange={(e) => patchPerson(i, { age: Number(e.target.value) })}
                      className={cn(SELECT, "disabled:bg-muted disabled:text-muted-foreground")}
                    />
                    <label className="flex h-10 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={pers.usesTobacco}
                        aria-label="Fumante"
                        onChange={(e) => patchPerson(i, { usesTobacco: e.target.checked })}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                    </label>
                    <div className="flex h-10 min-w-0 items-center">
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
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-status-red-bg hover:text-status-red-fg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span aria-hidden />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Planos da proposta — o coração da tela */}
      <section className="mt-4 flex flex-1 flex-col rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Planos da proposta
            {draft.length ? (
              <span className="ml-2 rounded-full bg-status-blue-bg px-2 py-0.5 text-xs font-semibold text-status-blue-fg">
                {draft.length}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={() => {
              setEditIndex(null);
              setEditorOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-card transition-colors hover:bg-muted"
          >
            <Pencil className="h-4 w-4" /> Adicionar manualmente
          </button>
        </div>
        <div className="flex flex-1 flex-col px-5 py-4">

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
            "group/drop relative flex cursor-pointer overflow-hidden rounded-lg border-2 border-dashed transition-colors",
            busy
              ? "flex-col items-center justify-center px-6 py-8 text-center"
              : "items-center gap-4 px-5 py-5",
            // Sem planos ainda, a área de soltar ocupa o espaço livre do card —
            // alvo grande em vez de uma faixa fina com vazio embaixo.
            !draft.length && !busy && "min-h-[120px] flex-1",
            dragging ? "border-primary bg-status-blue-bg" : "border-input bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
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
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
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
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors",
                  dragging ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary",
                )}
              >
                <ImagePlus className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  {dragging ? "Solte para adicionar" : "Adicione os prints dos planos"}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Arraste as imagens, cole com{" "}
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-foreground">
                    Ctrl+V
                  </kbd>{" "}
                  ou escolha os arquivos — lemos o print e preenchemos os campos.
                </span>
              </span>
              <span className="hidden h-10 shrink-0 items-center rounded-md border bg-background px-4 text-sm font-medium shadow-card transition-colors group-hover/drop:bg-muted sm:inline-flex">
                Escolher arquivos
              </span>
            </>
          )}
        </label>

        {pasted ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> Print colado
          </p>
        ) : null}

        {draft.length ? (
          // A prateleira da proposta: cada opção já numerada na ordem em que o
          // cliente vai receber, e entrando com a mesma animação da escolha.
          <div className="stagger mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {draft.map((o, i) => (
              <div key={o.planId || i} className="flex flex-col gap-1.5">
                <PlanCard plan={o} readOnly order={i + 1} printUrl={o.printUrl} />
                <div className="flex items-center gap-2 text-xs">
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
          <div className="mt-4">
            {recommendation ? (
              <div className="overflow-hidden rounded-lg border bg-card shadow-card">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold">Sugestão para apresentar</p>
                  <button
                    type="button"
                    onClick={() => setRecommendation(null)}
                    className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Descartar
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-base font-semibold tracking-tight">{recommendation.titulo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {draft.find((d) => d.planId === recommendation.planId)?.nomePlano ?? "—"}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed">{recommendation.motivo}</p>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {recommendation.pontos.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-green-fg" />
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
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sugestão gerada por IA a partir das opções escolhidas — confira antes de apresentar.
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={askRecommendation}
                disabled={recommending}
                className="inline-flex items-center gap-2 rounded-md border bg-card px-3.5 py-2 text-sm font-medium shadow-card transition-colors hover:bg-muted disabled:opacity-70"
              >
                {recommending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                {recommending ? "Analisando as opções…" : "Sugerir a melhor opção para este cliente"}
              </button>
            )}
          </div>
        ) : null}

          {/* mt-auto absorve a sobra (a nota fica no rodapé do card, que agora vai
              até o fim da tela); o mt-4 interno garante o respiro mínimo. */}
          <div className="mt-auto">
            <div className="mt-4 border-t pt-3">
              <EstimateNote text={LEAO_BRAND.disclaimer} variant="inline" />
            </div>
          </div>
        </div>
      </section>

      <BottomBar count={draft.length} generating={generating} onGenerate={generate} />

      {resultModal}

      <OptionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        option={editIndex != null ? draft[editIndex] ?? null : null}
        onSave={saveOption}
      />
    </div>
  );
}

/** Uma ficha em voo: de onde saiu, para onde vai, e o plano que ela representa. */
interface Flight {
  id: number;
  plan: PlanQuote;
  from: DOMRect;
  to: DOMRect;
}

/**
 * A ficha que viaja do card até o contador. Nasce no centro do card e é
 * transladada por CSS até o destino — dois frames de espera para o navegador
 * registrar a posição inicial antes da transição, senão ela já aparece chegando.
 */
function FlyChip({ flight }: { flight: Flight }) {
  const [moved, setMoved] = React.useState(false);
  React.useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setMoved(true)));
    return () => cancelAnimationFrame(r);
  }, []);

  const { from, to, plan } = flight;
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const metal = metalStyle(plan.metalLevel);

  return (
    <span
      aria-hidden
      className="leao-fly inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold shadow-card-hover"
      style={{
        left: from.x + from.width / 2,
        top: from.y + from.height / 2,
        color: metal.ink,
        transform: moved
          ? `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.45)`
          : "translate(-50%, -50%) scale(1)",
        opacity: moved ? 0.1 : 1,
      }}
    >
      <Check className="h-3.5 w-3.5" />
      {formatMoneyBR(plan.premioMensal)}
    </span>
  );
}

function BottomBar({
  count,
  generating,
  onGenerate,
  onBack,
  counterRef,
  bump,
}: {
  count: number;
  generating: boolean;
  onGenerate: () => void;
  onBack?: () => void;
  counterRef?: React.Ref<HTMLSpanElement>;
  /** Muda a cada plano recebido — remonta o selo para o pulso rodar de novo. */
  bump?: number;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex w-full items-center gap-3 px-5 py-3">
        <p className="flex items-center text-sm text-muted-foreground">
          {/* Âncora permanente: o destino do voo precisa existir ANTES do
              primeiro plano entrar, senão a primeira ficha não tem para onde ir. */}
          <span ref={counterRef} className="inline-flex items-center">
            {count ? (
              <span
                key={bump}
                className="animate-pulse-once mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
              >
                {count}
              </span>
            ) : null}
          </span>
          {count
            ? count === 1
              ? "plano na proposta"
              : "planos na proposta"
            : "Adicione ao menos um plano para gerar a proposta."}
        </p>
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack} className="h-9">
            Voltar à proposta
          </Button>
        ) : null}
        <Button onClick={onGenerate} disabled={!count || generating} className="ml-auto h-9 px-4">
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
  return <h2 className={cn("mb-2.5 text-sm font-semibold tracking-tight", className)}>{children}</h2>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  // Micro-label em caps — diferencia o título do campo do valor digitado.
  return (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}
