import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Mail } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { api } from '@/lib/api';
import type { SalesRep } from '@/types';

export function RepsManager({
  reps,
  monthlyByRep,
  onChange,
}: {
  reps: SalesRep[];
  monthlyByRep: Record<string, number>;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(rep: SalesRep) {
    setBusy(rep.id);
    try {
      await api.toggleRep(rep.id, !rep.active);
      toast.success(`${rep.name} ${!rep.active ? 'ativado' : 'desativado'}`);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function move(rep: SalesRep, dir: -1 | 1) {
    const sorted = [...reps].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((r) => r.id === rep.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setBusy(rep.id);
    try {
      await api.reorderReps(reordered.map((r) => r.id));
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <div className="card-title">Vendedores da fila</div>
          <div className="text-xs text-ink-500">
            Arraste a ordem com as setas. Desative para tirar temporariamente da rotação.
          </div>
        </div>
        <div className="text-xs text-ink-500">
          {reps.filter((r) => r.active).length} ativos · {reps.length} total
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
              <th className="px-5 py-2.5 font-medium w-16">Pos.</th>
              <th className="px-3 py-2.5 font-medium">Consultor</th>
              <th className="px-3 py-2.5 font-medium">Leads no mês</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((rep) => (
              <tr key={rep.id} className="table-row">
                <td className="px-5 py-3">
                  <span className="font-mono text-sm font-medium text-ink-700">#{rep.position}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={rep.name} src={rep.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <div className="font-medium text-ink-900 truncate">{rep.name}</div>
                      {rep.email && (
                        <div className="flex items-center gap-1 text-[11px] text-ink-500 truncate">
                          <Mail className="h-3 w-3" /> {rep.email}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="font-semibold text-ink-900">{monthlyByRep[rep.id] ?? 0}</span>
                  <span className="ml-1 text-xs text-ink-500">leads</span>
                </td>
                <td className="px-3 py-3">
                  {rep.active ? (
                    <Badge tone="success">Ativo</Badge>
                  ) : (
                    <Badge tone="neutral">Inativo</Badge>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => move(rep, -1)}
                      disabled={busy === rep.id || rep.position === 1}
                      title="Mover para cima"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => move(rep, 1)}
                      disabled={busy === rep.id || rep.position === reps.length}
                      title="Mover para baixo"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <div className="ml-2 flex items-center gap-2">
                      <Switch checked={rep.active} onCheckedChange={() => toggle(rep)} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
