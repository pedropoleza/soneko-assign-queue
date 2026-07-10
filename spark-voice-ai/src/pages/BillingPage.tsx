import { Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { Badge, Button, EmptyState } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils';
import type { CreditTx } from '@/types';

// Billing por créditos pré-pagos. A compra (Stripe) entra numa próxima etapa;
// por ora, leitura de saldo + extrato.
export function BillingPage() {
  const { data, loading } = useAsync<{ balance: number; transactions: CreditTx[] }>(
    () => api.listCredits().catch(() => ({ balance: 0, transactions: [] as CreditTx[] })),
    [],
  );
  const balance = data?.balance ?? 0;

  return (
    <div className="space-y-5">
      <p className="lead">Créditos & cobrança</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-header"><span className="card-title">Saldo de créditos</span><Badge tone="green">pré-pago</Badge></div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="text-[44px] font-bold tracking-tight tabular-nums text-ink-900">${balance.toFixed(2)}</div>
              <div className="pb-3 text-sm text-ink-500">disponível · pay-per-use, sem plano mensal</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled title="Recarga via Stripe — em breve"><Wallet size={16} /> Adicionar créditos</Button>
              <span className="text-xs text-ink-400">Compra via Stripe entra na próxima etapa.</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Custo por áudio</span></div>
          <div className="space-y-2.5 p-5 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Preço base</span><span className="tabular-nums">$0.0003 / caractere</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Áudio ~100 caract.</span><span className="tabular-nums">≈ $0.007</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Pagamento</span><Badge tone="brand">Stripe</Badge></div>
            <div className="text-[11.5px] leading-relaxed text-ink-400">Debitado do saldo a cada geração concluída. Falha não consome crédito.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Extrato de créditos</span></div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5"><div className="h-24 animate-pulse rounded-xl bg-ink-100" /></div>
          ) : data && data.transactions.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[10.5px] uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-2.5 font-semibold">Data</th>
                  <th className="px-4 py-2.5 font-semibold">Descrição</th>
                  <th className="px-4 py-2.5 font-semibold">Tipo</th>
                  <th className="px-4 py-2.5 font-semibold">Valor</th>
                  <th className="px-4 py-2.5 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink-500">{formatDateTime(t.created_at)}</td>
                    <td className="px-4 py-2.5 text-ink-700">{t.description ?? '—'}</td>
                    <td className="px-4 py-2.5"><Badge tone={t.kind === 'topup' ? 'green' : 'ink'}>{t.kind === 'topup' ? 'recarga' : t.kind === 'debit' ? 'consumo' : 'ajuste'}</Badge></td>
                    <td className={`px-4 py-2.5 tabular-nums ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{t.amount < 0 ? '−' : '+'}${Math.abs(t.amount).toFixed(4)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-ink-700">${t.balance_after.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Sem lançamentos" hint="Recargas e consumos aparecem aqui." />
          )}
        </div>
      </div>
    </div>
  );
}
