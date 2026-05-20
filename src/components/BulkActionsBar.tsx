import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Shuffle, SkipForward, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { api } from '@/lib/api';

export function BulkActionsBar({
  selected,
  onClear,
  onDone,
  activeRepsCount,
}: {
  selected: Set<string>;
  onClear: () => void;
  onDone: () => void;
  activeRepsCount: number;
}) {
  const [busy, setBusy] = useState<null | 'skip' | 'random'>(null);
  const [confirmRandom, setConfirmRandom] = useState(false);

  if (selected.size === 0) return null;
  const ids = Array.from(selected);

  async function bulkSkip() {
    setBusy('skip');
    try {
      const res = await api.bulkSkip(ids, null);
      const ok = res.results.filter((r) => r.sync === 'synced').length;
      const fail = res.results.length - ok;
      toast.success(`${ok} reatribuídos${fail ? `, ${fail} falharam (retry automático)` : ''}`);
      onClear(); onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function bulkRandom() {
    setBusy('random');
    setConfirmRandom(false);
    try {
      const res = await api.bulkRandom(ids);
      const ok = res.results.filter((r) => r.sync === 'synced').length;
      const fail = res.results.length - ok;
      const summary = Object.entries(res.summary)
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => `${name} ×${n}`)
        .join(', ');
      toast.success(
        `${ok} distribuídos aleatoriamente${fail ? `, ${fail} falharam` : ''}`,
        { description: summary, duration: 5000 },
      );
      onClear(); onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className="card px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-brand-50 border-brand-200">
        <div className="text-sm text-brand-800">
          <span className="font-semibold">{selected.size}</span> selecionado{selected.size === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onClear} disabled={!!busy}>
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
          <Button size="sm" variant="outline" onClick={bulkSkip} loading={busy === 'skip'} disabled={!!busy}>
            <SkipForward className="h-3.5 w-3.5" /> Pular pro próximo
          </Button>
          <Button size="sm" onClick={() => setConfirmRandom(true)} loading={busy === 'random'} disabled={!!busy}>
            <Shuffle className="h-3.5 w-3.5" /> Distribuir aleatório
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmRandom}
        onOpenChange={setConfirmRandom}
        title="Distribuir aleatoriamente"
        description={`${selected.size} lead${selected.size === 1 ? '' : 's'} ${selected.size === 1 ? 'será' : 'serão'} redistribuído${selected.size === 1 ? '' : 's'} entre os ${activeRepsCount} consultores disponíveis em ordem aleatória balanceada.`}
      >
        <div className="space-y-3">
          <div className="rounded-md bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
            <div className="font-medium text-ink-700 mb-1">Como funciona</div>
            A lista de consultores ativos é embaralhada uma vez e os leads são
            distribuídos round-robin a partir dela — cada consultor recebe ao
            menos um antes de qualquer um receber o segundo.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmRandom(false)}>Cancelar</Button>
            <Button onClick={bulkRandom}>
              <Shuffle className="h-3.5 w-3.5" /> Distribuir
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
