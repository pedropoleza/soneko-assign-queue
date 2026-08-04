"use client";

import * as React from "react";
import type { PlanQuote } from "@/lib/cotacao/types";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const METALS = ["Bronze", "Silver", "Gold", "Platinum", "Catastrophic"];

const blank = (): PlanQuote => ({
  planId: "",
  seguradora: "",
  nomePlano: "",
  metalLevel: "Silver",
  premioMensal: 0,
  premioSemCredito: 0,
  creditoFiscal: 0,
  dedutivel: null,
  maxBolso: null,
  atencaoPrimaria: null,
  atencaoEspecialista: null,
  atencaoUrgencia: null,
  emergencia: null,
  saudeMental: null,
  medicamentoGenerico: null,
  fonte: "manual",
});

/**
 * Hybrid model (CLAUDE.md §5): the broker can adjust the structured fields of a
 * plan pulled from the CMS, or type a fully manual option. Editing/typing marks
 * the option `fonte: "manual"` so we know it wasn't verbatim from the API.
 */
export function OptionEditor({
  open,
  onOpenChange,
  option,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  option: PlanQuote | null;
  onSave: (o: PlanQuote) => void;
}) {
  const [form, setForm] = React.useState<PlanQuote>(blank);

  React.useEffect(() => {
    if (open) setForm(option ?? blank());
  }, [open, option]);

  const set = (p: Partial<PlanQuote>) => setForm((s) => ({ ...s, ...p }));
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = () => {
    const planId = form.planId || `manual-${Math.abs(hash(form.nomePlano + form.seguradora))}`;
    onSave({ ...form, planId, fonte: "manual" });
    onOpenChange(false);
  };

  const isNew = !option?.planId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <DialogTitle>{isNew ? "Adicionar plano manual" : "Editar opção"}</DialogTitle>
          <DialogDescription>Ajuste os campos da ficha do plano. As alterações marcam a opção como manual.</DialogDescription>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <F label="Seguradora" className="sm:col-span-2">
              <Input value={form.seguradora} onChange={(e) => set({ seguradora: e.target.value })} />
            </F>
            <F label="Metal level">
              <select
                value={form.metalLevel}
                onChange={(e) => set({ metalLevel: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {METALS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </F>
            <F label="Nome do plano" className="col-span-2 sm:col-span-3">
              <Input value={form.nomePlano} onChange={(e) => set({ nomePlano: e.target.value })} />
            </F>

            <F label="Prêmio/mês (com crédito)">
              <Input type="number" value={form.premioMensal} onChange={(e) => set({ premioMensal: Number(e.target.value) })} />
            </F>
            <F label="Prêmio bruto">
              <Input type="number" value={form.premioSemCredito} onChange={(e) => set({ premioSemCredito: Number(e.target.value) })} />
            </F>
            <F label="Crédito fiscal (APTC)">
              <Input type="number" value={form.creditoFiscal} onChange={(e) => set({ creditoFiscal: Number(e.target.value) })} />
            </F>

            <F label="Dedutível">
              <Input type="number" value={form.dedutivel ?? ""} onChange={(e) => set({ dedutivel: numOrNull(e.target.value) })} />
            </F>
            <F label="Máx. do bolso">
              <Input type="number" value={form.maxBolso ?? ""} onChange={(e) => set({ maxBolso: numOrNull(e.target.value) })} />
            </F>
            <div />

            <F label="Atenção primária">
              <Input value={form.atencaoPrimaria ?? ""} onChange={(e) => set({ atencaoPrimaria: e.target.value || null })} />
            </F>
            <F label="Especialista">
              <Input value={form.atencaoEspecialista ?? ""} onChange={(e) => set({ atencaoEspecialista: e.target.value || null })} />
            </F>
            <F label="Urgência">
              <Input value={form.atencaoUrgencia ?? ""} onChange={(e) => set({ atencaoUrgencia: e.target.value || null })} />
            </F>
            <F label="Emergência">
              <Input value={form.emergencia ?? ""} onChange={(e) => set({ emergencia: e.target.value || null })} />
            </F>
            <F label="Saúde mental">
              <Input value={form.saudeMental ?? ""} onChange={(e) => set({ saudeMental: e.target.value || null })} />
            </F>
            <F label="Genéricos">
              <Input value={form.medicamentoGenerico ?? ""} onChange={(e) => set({ medicamentoGenerico: e.target.value || null })} />
            </F>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t pt-4">
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button size="sm" onClick={save} disabled={!form.nomePlano.trim()}>
              Salvar opção
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
