import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Check, Shuffle, UserCheck, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Select } from './ui/Select';
import { Avatar } from './ui/Avatar';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SalesRep } from '@/types';

export function BulkActionsBar({
  selected,
  reps,
  onClear,
  onDone,
}: {
  selected: Set<string>;
  reps: SalesRep[];
  onClear: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<null | 'single' | 'random'>(null);
  const [openSingle, setOpenSingle] = useState(false);
  const [openRandom, setOpenRandom] = useState(false);
  const [targetRep, setTargetRep] = useState<string | undefined>(undefined);
  const [pool, setPool] = useState<Set<string>>(new Set());

  const activeReps = reps.filter((r) => r.active);

  // Default the divide pool to all active reps whenever the modal opens
  useEffect(() => {
    if (openRandom) setPool(new Set(activeReps.map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRandom]);

  if (selected.size === 0) return null;
  const ids = Array.from(selected);
  const poolCount = pool.size;

  async function sendToOne() {
    if (!targetRep) { toast.error('Escolha um vendedor'); return; }
    setBusy('single');
    setOpenSingle(false);
    try {
      const res = await api.bulkSkip(ids, targetRep);
      const ok = res.results.filter((r) => r.sync === 'synced').length;
      const fail = res.results.length - ok;
      const repName = reps.find((r) => r.id === targetRep)?.name ?? 'vendedor';
      toast.success(`${ok} enviados para ${repName}${fail ? `, ${fail} falharam` : ''}`);
      setTargetRep(undefined);
      onClear(); onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  function togglePool(id: string) {
    setPool((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function divideAmong() {
    if (pool.size === 0) { toast.error('Selecione ao menos um vendedor'); return; }
    setBusy('random');
    setOpenRandom(false);
    try {
      const res = await api.bulkRandom(ids, Array.from(pool));
      const ok = res.results.filter((r) => r.sync === 'synced').length;
      const fail = res.results.length - ok;
      const summary = Object.entries(res.summary)
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => `${name} ×${n}`)
        .join(', ');
      toast.success(
        `${ok} divididos entre vendedores${fail ? `, ${fail} falharam` : ''}`,
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
          <Button size="sm" variant="outline" onClick={() => setOpenSingle(true)} loading={busy === 'single'} disabled={!!busy}>
            <UserCheck className="h-3.5 w-3.5" /> Enviar para 1 vendedor
          </Button>
          <Button size="sm" onClick={() => setOpenRandom(true)} loading={busy === 'random'} disabled={!!busy}>
            <Shuffle className="h-3.5 w-3.5" /> Dividir entre vendedores
          </Button>
        </div>
      </div>

      {/* Send all to one specific rep */}
      <Dialog
        open={openSingle}
        onOpenChange={setOpenSingle}
        title="Enviar para 1 vendedor"
        description={`Os ${selected.size} lead${selected.size === 1 ? '' : 's'} selecionado${selected.size === 1 ? '' : 's'} ${selected.size === 1 ? 'será atribuído' : 'serão atribuídos'} ao vendedor escolhido.`}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Vendedor de destino</label>
            <Select
              value={targetRep}
              onChange={setTargetRep}
              options={activeReps.map((r) => ({ value: r.id, label: `${r.name} (${r.recent_leads} leads/7d)` }))}
              placeholder="Escolher vendedor ativo..."
            />
          </div>
          {targetRep && (
            <div className="flex items-center gap-2 rounded-md bg-ink-50 px-3 py-2 text-sm">
              <Avatar name={reps.find((r) => r.id === targetRep)?.name ?? '?'} size="xs" />
              <span className="text-ink-700">
                Todos os {selected.size} vão para <strong>{reps.find((r) => r.id === targetRep)?.name}</strong>
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenSingle(false)}>Cancelar</Button>
            <Button onClick={sendToOne} disabled={!targetRep}>
              <UserCheck className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Divide randomly among selected active reps */}
      <Dialog
        open={openRandom}
        onOpenChange={setOpenRandom}
        title="Dividir entre vendedores"
        description={`${selected.size} lead${selected.size === 1 ? '' : 's'} ${selected.size === 1 ? 'será distribuído' : 'serão distribuídos'} aleatoriamente entre os vendedores marcados abaixo.`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-ink-600">
              Vendedores na divisão ({poolCount}/{activeReps.length})
            </label>
            <div className="flex gap-2 text-[11px]">
              <button className="text-brand-600 hover:underline" onClick={() => setPool(new Set(activeReps.map((r) => r.id)))}>
                Todos
              </button>
              <span className="text-ink-300">·</span>
              <button className="text-brand-600 hover:underline" onClick={() => setPool(new Set())}>
                Nenhum
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-ink-200 divide-y divide-ink-100">
            {activeReps.map((r) => {
              const checked = pool.has(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => togglePool(r.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    checked ? 'bg-brand-50/60' : 'hover:bg-ink-50',
                  )}
                >
                  <span className={cn(
                    'grid h-4 w-4 place-items-center rounded border transition-colors',
                    checked ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-white',
                  )}>
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <Avatar name={r.name} src={r.avatar_url} size="xs" />
                  <span className="flex-1 text-sm text-ink-800 truncate">{r.name}</span>
                  <span className="text-[11px] text-ink-500 tabular-nums">{r.recent_leads} leads/7d</span>
                </button>
              );
            })}
          </div>
          <div className="rounded-md bg-ink-50 px-3 py-2 text-[11px] text-ink-500">
            Os marcados são embaralhados e recebem os leads round-robin — cada um recebe ao menos um antes de alguém receber o segundo.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenRandom(false)}>Cancelar</Button>
            <Button onClick={divideAmong} disabled={poolCount === 0}>
              <Shuffle className="h-3.5 w-3.5" /> Dividir entre {poolCount}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
