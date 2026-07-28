"use client";

import * as React from "react";
import { Plus, Trash2, Search, Link2, Check, Loader2, ExternalLink } from "lucide-react";
import { cotacaoApi, type CreateQuoteResult } from "@/lib/client/cotacao";
import { LEAO_BRAND } from "@/lib/cotacao/brand";
import type { PlanQuote, QuotePerson, QuoteProfile } from "@/lib/cotacao/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EstimateNote } from "@/components/cotacao/estimate-note";
import { PlanCard } from "@/components/cotacao/plan-card";
import { ErrorState } from "@/components/ui/data-state";

const emptyPerson = (relationship: QuotePerson["relationship"] = "Self"): QuotePerson => ({
  age: 30,
  gender: "Male",
  relationship,
  aptcEligible: true,
  usesTobacco: false,
});

/**
 * Ponta A (foundation) — the broker builds a quote: household → CMS estimate →
 * pick options → generate the shareable proposal link. Print upload and the
 * full option editor come in the approved phase; this proves the data path.
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
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
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
      setSelected({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const chosen = (plans ?? []).filter((p) => selected[p.planId]);

  const generate = async () => {
    if (!chosen.length) return;
    setGenerating(true);
    setError(null);
    try {
      setResult(await cotacaoApi.create(profile, chosen));
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
      <Card className="p-5">
        <h2 className="text-sm font-semibold tracking-tight">Perfil da família</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Dados enviados à API do CMS para estimar preço e crédito fiscal.</p>

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

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Pessoas no núcleo familiar</p>
          {profile.people.map((pers, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-2.5">
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
          <Button variant="outline" size="sm" onClick={addPerson}>
            <Plus className="h-4 w-4" /> Adicionar pessoa
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={search} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar planos
          </Button>
          {usingFixtures && plans ? <Badge tone="amber">Dados de exemplo (sem chave do CMS)</Badge> : null}
        </div>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      {/* Planos + seleção */}
      {plans ? (
        <div className="space-y-3">
          <EstimateNote text={LEAO_BRAND.disclaimer} />
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Planos disponíveis ({plans.length})</h2>
            <p className="text-xs text-muted-foreground">{chosen.length} selecionado(s) para propor</p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {plans.map((p) => (
              <PlanCard
                key={p.planId}
                plan={p}
                selected={!!selected[p.planId]}
                onToggle={() => setSelected((s) => ({ ...s, [p.planId]: !s[p.planId] }))}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={generate} disabled={!chosen.length || generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Gerar proposta ({chosen.length})
            </Button>
          </div>
        </div>
      ) : null}

      {/* Link gerado */}
      {result ? (
        <Card className="border-primary/30 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Check className="h-4 w-4" /> Proposta gerada
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Link válido até {new Date(result.expiresAt).toLocaleDateString("pt-BR")}. O contato foi marcado com <code>cotacao_enviada</code> no GHL.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input readOnly value={result.url || `${typeof location !== "undefined" ? location.origin : ""}/proposta/${result.token}`} className="max-w-md font-mono text-xs" />
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
      ) : null}
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
