import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import type { SalesRep, TagRule } from '@/types';

export function TagRulesManager({ reps }: { reps: SalesRep[] }) {
  const [rules, setRules] = useState<TagRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [newRep, setNewRep] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  async function load() {
    try { setRules(await api.listTagRules()); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!newTag.trim() || !newRep) {
      toast.error('Preencha tag e vendedor');
      return;
    }
    setAdding(true);
    try {
      await api.upsertTagRule(newTag.trim().toLowerCase(), newRep);
      toast.success('Regra criada');
      setNewTag(''); setNewRep(undefined);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setAdding(false); }
  }

  async function remove(id: string) {
    try { await api.deleteTagRule(id); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <div className="card-title flex items-center gap-2"><Tag className="h-4 w-4 text-ink-400" /> Regras por tag</div>
          <div className="text-xs text-ink-500">Leads com tag específica vão sempre pro vendedor escolhido, ignorando a fila.</div>
        </div>
      </div>

      <div className="p-4 border-b border-ink-100 bg-ink-50/30">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-[11px] font-medium text-ink-600">Tag</label>
            <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="ex: vip, parceria-acme" />
          </div>
          <div className="w-64">
            <label className="mb-1 block text-[11px] font-medium text-ink-600">Vendedor</label>
            <Select value={newRep} onChange={setNewRep}
                    options={reps.filter((r) => r.active).map((r) => ({ value: r.id, label: r.name }))}
                    placeholder="Escolher..." />
          </div>
          <Button onClick={add} loading={adding}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-400">Carregando regras...</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">
            <div>Nenhuma regra cadastrada.</div>
            <div className="text-xs mt-1">Sem regras, todos os leads seguem o round-robin normal.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-5 py-2.5 font-medium">Tag</th>
                <th className="px-3 py-2.5 font-medium">Vendedor</th>
                <th className="px-3 py-2.5 font-medium">Prioridade</th>
                <th className="px-5 py-2.5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const rep = reps.find((x) => x.id === r.rep_id);
                return (
                  <tr key={r.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                    <td className="px-5 py-3"><Badge tone="brand">{r.tag}</Badge></td>
                    <td className="px-3 py-3">
                      {rep ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={rep.name} src={rep.avatar_url} size="xs" />
                          <span>{rep.name}</span>
                        </div>
                      ) : (<span className="text-ink-400">{r.rep_name ?? '—'}</span>)}
                    </td>
                    <td className="px-3 py-3 text-ink-600">{r.priority}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)} title="Remover">
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
