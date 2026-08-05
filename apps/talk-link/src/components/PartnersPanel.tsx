import { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PARTNER_KINDS } from '@/lib/message';
import type { AppState } from '@/types';
import { pct } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select } from './ui';
import { RankBar } from './Stats';

export function PartnersPanel({ state, onRefresh }: { state: AppState; onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('influencer');
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);

  const ranked = [...state.partners].sort((a, b) => b.sends - a.sends || b.clicks - a.clicks);
  const maxClicks = Math.max(1, ...ranked.map((p) => p.clicks));

  async function add() {
    if (name.trim().length < 2) return toast.error('Informe o nome do parceiro.');
    setSaving(true);
    try {
      await api.savePartner({ name: name.trim(), kind: kind as never, handle: handle.trim() || null });
      toast.success('Parceiro salvo');
      setName('');
      setHandle('');
      onRefresh();
    } catch (e) {
      toast.error(`Não deu para salvar: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, partnerName: string) {
    if (!confirm(`Remover "${partnerName}"? Os links dele continuam funcionando, mas ficam sem parceiro.`)) return;
    try {
      await api.deletePartner(id);
      toast.success('Parceiro removido');
      onRefresh();
    } catch (e) {
      toast.error(`Não deu para remover: ${String(e)}`);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit">
        <CardHeader title="Novo parceiro" subtitle="Cadastre antes ou deixe que o gerador crie sozinho." />
        <div className="space-y-4 p-5">
          <Field label="Nome" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria Silva" />
          </Field>
          <Field label="Tipo">
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={PARTNER_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            />
          </Field>
          <Field label="Perfil / canal" hint="Opcional — @ do Instagram, canal do YouTube, nome da loja.">
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@mariasilva" />
          </Field>
          <Button onClick={add} loading={saving} className="w-full">
            <Plus className="h-3.5 w-3.5" />
            Adicionar parceiro
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Desempenho por parceiro"
          subtitle={`Cliques e envios confirmados nos últimos ${state.window_days} dias.`}
        />
        {ranked.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Nenhum parceiro cadastrado"
            description="Cadastre ao lado, ou gere um link informando o nome — o parceiro é criado junto."
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {ranked.map((p) => (
              <div key={p.id} className="group relative">
                <div className="flex items-start justify-between gap-3 px-5 pt-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink-900">{p.name}</span>
                      <Badge>{PARTNER_KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}</Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-400">
                      {p.links} link{p.links === 1 ? '' : 's'}
                      {p.handle ? ` · ${p.handle}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-brand-700">{p.sends}</div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-400">envios</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-ink-700">{pct(p.sends, p.clicks)}</div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-400">conversão</div>
                    </div>
                    <button
                      onClick={() => remove(p.id, p.name)}
                      title="Remover"
                      className="rounded-md p-1.5 text-ink-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <RankBar label="cliques" value={p.clicks} total={maxClicks} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
