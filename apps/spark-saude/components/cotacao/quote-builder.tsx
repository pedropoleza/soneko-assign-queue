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
  Layers,
  Wallet,
  BadgePercent,
  CheckCircle2,
  Users,
} from "lucide-react";
import { cotacaoApi, type CreateQuoteResult } from "@/lib/client/cotacao";
import { LEAO_BRAND } from "@/lib/cotacao/brand";
import type { PlanQuote, QuotePerson, QuoteProfile } from "@/lib/cotacao/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shell/section-header";
import { StatCard } from "@/components/overview/stat-card";
import { EstimateNote } from "@/components/cotacao/estimate-note";
import { PlanCard } from "@/components/cotacao/plan-card";
import { ContactPicker } from "@/components/cotacao/contact-picker";
import { OptionEditor } from "@/components/cotacao/option-editor";
import { ErrorState } from "@/components/ui/data-state";
import { formatMoneyBR } from "@/lib/utils";

const emptyPerson = (relationship: QuotePerson["relationship"] = "Self"): QuotePerson => ({
  age: 30,
  gender: "Male",
  relationship,
  aptcEligible: true,
  usesTobacco: false,
});

/**
 * Ponta A — the broker builds a quote: household → CMS estimate → pick options →
 * generate the shareable proposal link. Styled to camouflage inside GHL: glass
 * section bars, color-coded summary tiles and clean hover cards, matching the
 * Spark Saúde dashboard.
 */
export function QuoteBuilder() {
  const nextYear = new Date().getFullYear() + 1;
  const [profile, setProfile] = React.useState<QuoteProfile>({
    zipcode: "33073",
    state: "FL",
    income: 33000,
    year: nextYear,
    people: [emptyPerson("Self"), emptyPerson("Spouse")],
  });
  const [plans, setPlans] = React.useState<PlanQuote[] | null>(null);
  const [usingFixtures, setUsingFixtures] = React.useState(false);
  const [draft, setDraft] = React.useState<PlanQuote[]>([]);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CreateQuoteResult | null>(null);
  const [copied, setCopied] = React.useState(false);

  const patch = (p: Partial<QuoteProfile>) => setProfile((s) => ({ ...s, ...p }));
  const patchPerson = (i: number, p: Partial<QuotePerson>) =>
    setProfile((s) => ({ ...s, people: s.people.map((pers, idx) => (idx === i ? { ...pers, ...p } : pers)) }));
  const addPerson = () => setProfile((s) => ({ ...s, people: [...s.people, emptyPerson("Child")] }));
  const removePerson = (i: number) => setProfile((s) => ({ ...s, people: s.people.filter((_, idx) => idx !== i) }));

  const search = async () => {
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const res = await cotacaoApi.search(profile);
      setPlans(res.plans);
      setUsingFixtures(res.usingFixtures);
      setDraft([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const inDraft = (planId: string) => draft.some((d) => d.planId === planId);
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
      copy[editIndex] = o;
      return copy;
    });

  const minPremio = plans?.length ? Math.min(...plans.map((p) => p.premioMensal)) : 0;
  const maxCredito = plans?.length ? Math.max(...plans.map((p) => p.creditoFiscal)) : 0;
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
    <div className="space-y-6">
      {/* Perfil da família */}
      <section>
        <SectionHeader title="Perfil da família" className="mb-4" />
        <Card className="p-5">
          <div className="mb-4">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Cliente (contato no GHL)</span>
            <ContactPicker
              value={{ id: profile.contactId, name: profile.contactName }}
              onSelect={(c) => patch({ contactId: c.id, contactName: c.name })}
            />
          </div>

          <p className="text-xs text-muted-foreground">Dados enviados à API do CMS (Marketplace) para estimar preço e crédito fiscal.</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="CEP (zipcode)">
              <Input value={profile.zipcode} onChange={(e) => patch({ zipcode: e.target.value })} inputMode="numeric" />
            </Field>
            <Field label="Estado">
              <Input value={profile.state} onChange={(e) => patch({ state: e.target.value.toUpperCase().slice(0, 2) })} />
            </Field>
            <Field label="Renda anual (US$)">
              <Input type="number" value={profile.income} onChange={(e) => patch({ income: Number(e.target.value) })} />
            </Field>
            <Field label="Ano">
              <Input type="number" value={profile.year} onChange={(e) => patch({ year: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Núcleo familiar · {profile.people.length}
              </p>
            </div>
            <div className="space-y-2">
              {profile.people.map((pers, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2.5 rounded-lg border bg-muted/30 p-3">
                  <span className="flex h-9 w-6 items-center justify-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <Field label="Idade" className="w-20">
                    <Input type="number" value={pers.age} onChange={(e) => patchPerson(i, { age: Number(e.target.value) })} />
                  </Field>
                  <Field label="Gênero" className="w-28">
                    <Select value={pers.gender} onChange={(v) => patchPerson(i, { gender: v as QuotePerson["gender"] })} options={["Male", "Female"]} />
                  </Field>
                  <Field label="Relação" className="w-32">
                    <Select
                      value={pers.relationship}
                      onChange={(v) => patchPerson(i, { relationship: v as QuotePerson["relationship"] })}
                      options={["Self", "Spouse", "Child", "Dependent"]}
                    />
                  </Field>
                  <label className="flex h-9 items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={pers.usesTobacco} onChange={(e) => patchPerson(i, { usesTobacco: e.target.checked })} />
                    Tabaco
                  </label>
                  {profile.people.length > 1 ? (
                    <Button variant="ghost" size="icon" onClick={() => removePerson(i)} aria-label="Remover pessoa" className="ml-auto text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addPerson} className="mt-2.5">
              <Plus className="h-4 w-4" /> Adicionar pessoa
            </Button>
          </div>

          <div className="mt-5 flex items-center gap-3 border-t pt-4">
            <Button onClick={search} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar planos
            </Button>
            {usingFixtures && plans ? <Badge tone="amber">Dados de exemplo (sem chave do CMS)</Badge> : null}
          </div>
        </Card>
      </section>

      {error ? <ErrorState message={error} /> : null}

      {/* Resultado */}
      {plans ? (
        <>
          {/* Resumo — tiles no padrão do dashboard */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Planos encontrados" value={plans.length} icon={Layers} tone="blue" hint="Na sua região" />
            <StatCard label="Menor prêmio/mês" value={formatMoneyBR(minPremio)} icon={Wallet} tone="green" accent hint="Estimado, com crédito" />
            <StatCard label="Maior crédito fiscal" value={formatMoneyBR(maxCredito)} icon={BadgePercent} tone="violet" hint="APTC estimado / mês" />
            <StatCard label="Na proposta" value={draft.length} icon={CheckCircle2} tone="amber" hint="Opções escolhidas" />
          </div>

          <section>
            <SectionHeader title="Planos disponíveis" className="mb-4" />
            <EstimateNote text={LEAO_BRAND.disclaimer} />
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {plans.map((p) => (
                <PlanCard key={p.planId} plan={p} selected={inDraft(p.planId)} best={p.planId === bestId} onToggle={() => toggle(p)} />
              ))}
            </div>
          </section>

          {/* Opções da proposta — modelo híbrido (editar / adicionar manual) */}
          <section>
            <SectionHeader title="Opções da proposta" className="mb-4" />
            <Card className="p-4">
              {draft.length === 0 ? (
                <p className="px-1 py-3 text-sm text-muted-foreground">
                  Selecione planos acima ou adicione uma opção manual. Você pode ajustar qualquer campo antes de gerar a proposta.
                </p>
              ) : (
                <ul className="divide-y">
                  {draft.map((o, i) => (
                    <li key={o.planId || i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{o.nomePlano}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {o.seguradora} · {o.metalLevel} · {formatMoneyBR(o.premioMensal)}/mês
                          </p>
                        </div>
                        {o.fonte === "manual" ? <Badge tone="gray">manual</Badge> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(i)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => removeOption(i)} className="text-muted-foreground">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="outline" size="sm" onClick={openManualAdd} className="mt-3">
                <Plus className="h-4 w-4" /> Adicionar plano manual
              </Button>
            </Card>
          </section>

          {/* Ação — gerar proposta */}
          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-card-hover backdrop-blur">
            <p className="text-sm text-muted-foreground">
              {draft.length ? (
                <>
                  <span className="font-semibold text-foreground">{draft.length}</span> opção(ões) na proposta
                </>
              ) : (
                "Selecione os planos que quer propor ao cliente."
              )}
            </p>
            <Button onClick={generate} disabled={!draft.length || generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Gerar proposta
            </Button>
          </div>
        </>
      ) : null}

      {/* Link gerado */}
      {result ? (
        <section>
          <SectionHeader title="Proposta gerada" className="mb-4" />
          <Card className="border-primary/30 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(21,94,239,0.10)]">
                <Check className="h-4 w-4" />
              </span>
              Link pronto para enviar ao cliente
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Válido até {new Date(result.expiresAt).toLocaleDateString("pt-BR")}. O contato foi marcado com <code className="rounded bg-muted px-1 py-0.5">cotacao_enviada</code> no GHL.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={result.url || `${typeof location !== "undefined" ? location.origin : ""}/proposta/${result.token}`}
                className="max-w-md font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? "Copiado" : "Copiar"}
              </Button>
              <a href={`/proposta/${result.token}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" /> Abrir proposta
                </Button>
              </a>
            </div>
          </Card>
        </section>
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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
