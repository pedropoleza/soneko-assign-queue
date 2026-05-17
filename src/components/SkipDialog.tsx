import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, SkipForward } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { Avatar } from './ui/Avatar';
import type { Assignment, SalesRep } from '@/types';
import { api } from '@/lib/api';

type Mode = 'next' | 'specific';

export function SkipDialog({
  open,
  onOpenChange,
  assignment,
  currentRep,
  nextRep,
  allReps,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assignment: Assignment | null;
  currentRep: SalesRep | null;
  nextRep: SalesRep | null;
  allReps: SalesRep[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>('next');
  const [targetId, setTargetId] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!assignment) return null;

  const selectableReps = allReps.filter((r) => r.active && r.id !== currentRep?.id);

  async function submit() {
    if (!assignment) return;
    if (mode === 'specific' && !targetId) {
      toast.error('Selecione o vendedor de destino');
      return;
    }
    setSubmitting(true);
    try {
      const target = mode === 'specific' ? targetId! : null;
      const res = await api.skip(assignment.id, target, reason || undefined);
      if (res.sync === 'synced') {
        toast.success(`Lead reatribuído para ${res.rep.name}`);
      } else {
        toast.warning(`Reatribuído para ${res.rep.name}, mas o GHL falhou: ${res.error}`);
      }
      onDone();
      onOpenChange(false);
      setReason('');
      setTargetId(undefined);
      setMode('next');
    } catch (e) {
      toast.error(`Falha ao pular: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pular vendedor"
      description={`${assignment.contact_name ?? 'Contato'} está atualmente com ${currentRep?.name ?? '—'}.`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Avatar name={currentRep?.name ?? '?'} size="xs" />
            <span className="text-ink-700">{currentRep?.name ?? '—'}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-400" />
          <div className="flex items-center gap-2 text-sm font-medium">
            {mode === 'next' ? (
              <>
                <Avatar name={nextRep?.name ?? '?'} size="xs" />
                <span className="text-brand-700">{nextRep?.name ?? 'Próximo da fila'}</span>
              </>
            ) : targetId ? (
              <>
                <Avatar name={selectableReps.find((r) => r.id === targetId)?.name ?? '?'} size="xs" />
                <span className="text-brand-700">{selectableReps.find((r) => r.id === targetId)?.name}</span>
              </>
            ) : (
              <span className="text-ink-400">Selecione abaixo</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('next')}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
              mode === 'next'
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-ink-200 hover:bg-ink-50 text-ink-700'
            }`}
          >
            <div className="font-semibold">Próximo da fila</div>
            <div className="text-xs text-ink-500">Avança um na ordem normal</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('specific')}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
              mode === 'specific'
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-ink-200 hover:bg-ink-50 text-ink-700'
            }`}
          >
            <div className="font-semibold">Vendedor específico</div>
            <div className="text-xs text-ink-500">Você escolhe quem recebe</div>
          </button>
        </div>

        {mode === 'specific' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Vendedor de destino</label>
            <Select
              value={targetId}
              onChange={setTargetId}
              options={selectableReps.map((r) => ({ value: r.id, label: `${r.name} (#${r.position})` }))}
              placeholder="Escolher vendedor..."
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Motivo (opcional)</label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: vendedor de férias, lead específico, etc."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={submitting}>
            <SkipForward className="h-4 w-4" />
            Confirmar pulo
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
