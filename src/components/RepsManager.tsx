import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Check, Clock, GripVertical, Mail, Plane, Settings2 } from 'lucide-react';
import { TrendArrow } from './ui/TrendArrow';
import {
  DndContext, type DragEndEvent,
  KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove,
  sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { Input } from './ui/Input';
import { Dialog } from './ui/Dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SalesRep } from '@/types';

export function RepsManager({
  reps,
  monthlyByRep,
  previousMonthlyByRep,
  onChange,
  mutateRep,
}: {
  reps: SalesRep[];
  monthlyByRep: Record<string, number>;
  previousMonthlyByRep: Record<string, number>;
  onChange: () => void;
  mutateRep: (id: string, patch: Partial<SalesRep>) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<SalesRep | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function toggle(rep: SalesRep) {
    setBusy(rep.id);
    mutateRep(rep.id, { active: !rep.active });
    try {
      await api.toggleRep(rep.id, !rep.active);
      toast.success(`${rep.name} ${!rep.active ? 'ativado' : 'desativado'}`);
      onChange();
    } catch (e) {
      mutateRep(rep.id, { active: rep.active }); // rollback
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const sorted = [...reps].sort((a, b) => a.position - b.position);
    const oldIdx = sorted.findIndex((r) => r.id === active.id);
    const newIdx = sorted.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(sorted, oldIdx, newIdx);
    // Optimistic update of positions
    reordered.forEach((r, i) => mutateRep(r.id, { position: i + 1 }));
    try {
      await api.reorderReps(reordered.map((r) => r.id));
      onChange();
    } catch (err) {
      toast.error((err as Error).message);
      onChange(); // refetch to undo
    }
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <div className="card-title">Vendedores da fila</div>
            <div className="text-xs text-ink-500">
              Arraste para reordenar. Clique no ícone de engrenagem para configurar peso, férias e horário.
            </div>
          </div>
          <div className="text-xs text-ink-500">
            {reps.filter((r) => r.active).length} ativos · {reps.filter((r) => r.available).length} disponíveis · {reps.length} total
          </div>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={[...reps].sort((a,b) => a.position - b.position).map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="pl-5 pr-2 py-2.5 font-medium w-10"></th>
                  <th className="px-2 py-2.5 font-medium w-12">#</th>
                  <th className="px-3 py-2.5 font-medium">Consultor</th>
                  <th className="px-3 py-2.5 font-medium">Peso</th>
                  <th className="px-3 py-2.5 font-medium">Disponibilidade</th>
                  <th className="px-3 py-2.5 font-medium">7d</th>
                  <th className="px-3 py-2.5 font-medium">Mês</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {[...reps].sort((a, b) => a.position - b.position).map((rep) => (
                  <SortableRow
                    key={rep.id}
                    rep={rep}
                    monthly={monthlyByRep[rep.id] ?? 0}
                    prevMonthly={previousMonthlyByRep[rep.id] ?? 0}
                    busy={busy === rep.id}
                    onToggle={() => toggle(rep)}
                    onEdit={() => setEditing(rep)}
                    mutateRep={mutateRep}
                  />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      <RepSettingsDialog
        rep={editing}
        onClose={() => setEditing(null)}
        onSaved={onChange}
        mutateRep={mutateRep}
      />
    </>
  );
}

function SortableRow({
  rep, monthly, prevMonthly, busy, onToggle, onEdit, mutateRep,
}: {
  rep: SalesRep; monthly: number; prevMonthly: number; busy: boolean;
  onToggle: () => void; onEdit: () => void;
  mutateRep: (id: string, patch: Partial<SalesRep>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rep.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const onVacation = rep.vacation_start && rep.vacation_end
    && new Date(rep.vacation_start) <= new Date() && new Date(rep.vacation_end) >= new Date();
  const hasHours = rep.working_hours_start && rep.working_hours_end;
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightDraft, setWeightDraft] = useState(rep.weight);

  async function saveWeight() {
    const w = Math.max(1, Math.min(10, weightDraft));
    setEditingWeight(false);
    if (w === rep.weight) return;
    mutateRep(rep.id, { weight: w });
    try { await api.updateRepSettings(rep.id, { weight: w }); toast.success(`${rep.name}: peso ${w}x`); }
    catch (e) { mutateRep(rep.id, { weight: rep.weight }); toast.error((e as Error).message); }
  }

  return (
    <tr ref={setNodeRef} style={style}
        className={cn(
          'border-b border-ink-100 last:border-0 transition-colors hover:bg-ink-50/60',
          isDragging && 'bg-brand-50/50 shadow-lg',
          !rep.active && 'bg-rose-50/30',
        )}>
      <td className="pl-5 pr-2 py-3">
        <button {...attributes} {...listeners} className="cursor-grab text-ink-300 hover:text-ink-600 active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-2 py-3">
        <span className="font-mono text-sm font-medium text-ink-700">#{rep.position}</span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(!rep.active && 'grayscale')}>
            <Avatar name={rep.name} src={rep.avatar_url} size="sm"
                    status={!rep.active ? 'inactive' : !rep.available ? 'unavailable' : 'available'} />
          </div>
          <div className="min-w-0">
            <div className={cn(
              'font-medium truncate',
              !rep.active
                ? 'text-ink-500 line-through decoration-rose-400/60 decoration-1'
                : 'text-ink-900',
            )}>{rep.name}</div>
            {rep.email && (
              <div className="flex items-center gap-1 text-[11px] text-ink-500 truncate">
                <Mail className="h-3 w-3" /> {rep.email}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        {editingWeight ? (
          <div className="inline-flex items-center gap-1">
            <input
              type="number" min={1} max={10} autoFocus
              value={weightDraft}
              onChange={(e) => setWeightDraft(+e.target.value || 1)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveWeight(); if (e.key === 'Escape') { setEditingWeight(false); setWeightDraft(rep.weight); } }}
              onBlur={saveWeight}
              className="h-6 w-14 rounded border border-brand-300 px-1.5 text-sm font-medium text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <Check className="h-3 w-3 text-emerald-500" />
          </div>
        ) : (
          <button onClick={() => { setEditingWeight(true); setWeightDraft(rep.weight); }}
                  title="Click para editar">
            <Badge tone={rep.weight > 1 ? 'brand' : 'neutral'} className="cursor-pointer hover:ring-2 hover:ring-brand-200">
              {rep.weight}x
            </Badge>
          </button>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {onVacation && (
            <Badge tone="warn"><Plane className="h-3 w-3" /> Férias</Badge>
          )}
          {hasHours && (
            <Badge tone="neutral"><Clock className="h-3 w-3" /> {rep.working_hours_start?.slice(0, 5)}–{rep.working_hours_end?.slice(0, 5)}</Badge>
          )}
          {!onVacation && !hasHours && <span className="text-[11px] text-ink-400">24/7</span>}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="font-semibold text-ink-900">{rep.recent_leads}</span>
        <span className="ml-1 text-[10px] text-ink-500">leads</span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink-900">{monthly}</span>
          <TrendArrow current={monthly} previous={prevMonthly} />
        </div>
      </td>
      <td className="px-3 py-3">
        {!rep.active
          ? <Badge tone="danger" className="font-semibold uppercase tracking-wide">Fora da fila</Badge>
          : !rep.available
          ? <Badge tone="warn">Indisponível</Badge>
          : <Badge tone="success">Ativo</Badge>}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={onEdit} title="Configurações">
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Switch checked={rep.active} onCheckedChange={onToggle} />
          {busy && <span className="h-3 w-3 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />}
        </div>
      </td>
    </tr>
  );
}

function RepSettingsDialog({
  rep, onClose, onSaved, mutateRep,
}: {
  rep: SalesRep | null; onClose: () => void; onSaved: () => void;
  mutateRep: (id: string, patch: Partial<SalesRep>) => void;
}) {
  const [weight, setWeight] = useState(rep?.weight ?? 1);
  const [vacationStart, setVacationStart] = useState(rep?.vacation_start ?? '');
  const [vacationEnd, setVacationEnd] = useState(rep?.vacation_end ?? '');
  const [whStart, setWhStart] = useState(rep?.working_hours_start?.slice(0, 5) ?? '');
  const [whEnd, setWhEnd] = useState(rep?.working_hours_end?.slice(0, 5) ?? '');
  const [tz, setTz] = useState(rep?.timezone ?? 'America/Sao_Paulo');
  const [saving, setSaving] = useState(false);

  // Reset state when rep changes
  if (rep && rep.id !== (window as any).__sonekoEditingRep) {
    (window as any).__sonekoEditingRep = rep.id;
    setWeight(rep.weight);
    setVacationStart(rep.vacation_start ?? '');
    setVacationEnd(rep.vacation_end ?? '');
    setWhStart(rep.working_hours_start?.slice(0, 5) ?? '');
    setWhEnd(rep.working_hours_end?.slice(0, 5) ?? '');
    setTz(rep.timezone);
  }

  async function save() {
    if (!rep) return;
    setSaving(true);
    const patch = {
      weight,
      vacation_start: vacationStart || '1900-01-01',
      vacation_end: vacationEnd || '1900-01-01',
      working_hours_start: whStart || 'clear',
      working_hours_end: whEnd || 'clear',
      timezone: tz,
    };
    try {
      await api.updateRepSettings(rep.id, patch);
      mutateRep(rep.id, {
        weight,
        vacation_start: vacationStart || null,
        vacation_end: vacationEnd || null,
        working_hours_start: whStart ? `${whStart}:00` : null,
        working_hours_end: whEnd ? `${whEnd}:00` : null,
        timezone: tz,
      });
      toast.success('Configurações salvas');
      onSaved();
      (window as any).__sonekoEditingRep = null;
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!rep} onOpenChange={(v) => !v && (((window as any).__sonekoEditingRep = null), onClose())}
            title={rep ? `Configurar ${rep.name}` : ''}
            description="Peso de distribuição, modo férias e horário de trabalho.">
      {rep && (
        <div className="space-y-4">
          <Field label="Peso (1–10)" hint="Maior peso = recebe mais leads consecutivos antes de avançar a fila">
            <Input type="number" min={1} max={10} value={weight} onChange={(e) => setWeight(Math.max(1, Math.min(10, +e.target.value || 1)))} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Férias - início" hint="vazio = sem férias">
              <Input type="date" value={vacationStart} onChange={(e) => setVacationStart(e.target.value)} />
            </Field>
            <Field label="Férias - fim">
              <Input type="date" value={vacationEnd} onChange={(e) => setVacationEnd(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Horário de trabalho" hint="vazio = 24/7">
              <Input type="time" value={whStart} onChange={(e) => setWhStart(e.target.value)} />
            </Field>
            <Field label="Até">
              <Input type="time" value={whEnd} onChange={(e) => setWhEnd(e.target.value)} />
            </Field>
          </div>

          <Field label="Timezone">
            <Input value={tz} onChange={(e) => setTz(e.target.value)} placeholder="America/Sao_Paulo" />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={save} loading={saving}>Salvar</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-700">{label}</label>
      {children}
      {hint && <div className="mt-1 text-[11px] text-ink-500">{hint}</div>}
    </div>
  );
}
