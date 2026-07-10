import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { API_URL } from '@/lib/config';
import { Badge } from '@/components/ui/primitives';
import { toast } from '@/lib/toast';
import type { AppState } from '@/types';

const WEBHOOK_URL = API_URL ? API_URL.replace(/spark-api\/?$/, 'spark-ghl-webhook') : '';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copiado');
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-ink-600">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-ink-200 bg-ink-50 px-3 py-2.5 text-xs text-ink-700">{value || '—'}</code>
        <button onClick={copy} className="btn-glass btn-sm shrink-0" disabled={!value}>
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export function SettingsPage({ state }: { state: AppState }) {
  const a = state.account;
  return (
    <div>
      <p className="lead">Configuração</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Conta</span></div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Empresa</span><span className="font-semibold text-ink-900">{a.company_name}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Location (GHL)</span><code className="text-xs text-ink-700">{a.ghl_location_id}</code></div>
            <div className="flex justify-between"><span className="text-ink-500">Status</span><Badge tone={a.status === 'active' ? 'green' : 'red'}>{a.status}</Badge></div>
            <div className="flex justify-between"><span className="text-ink-500">Saldo de créditos</span><span className="font-bold tabular-nums text-ink-900">${a.credit_balance.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Cobrança</span><Badge tone="brand">pay-per-use</Badge></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Webhook do GoHighLevel</span></div>
          <div className="space-y-4 p-5">
            <CopyRow label="URL do webhook (workflow → Webhook POST)" value={WEBHOOK_URL} />
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-3.5 text-xs text-ink-500">
              No workflow do GHL, adicione uma ação <b>Webhook (POST)</b> com o header{' '}
              <code>x-spark-webhook-secret</code> e o body JSON com <code>location.id</code>, <code>event_type</code> e o objeto <code>vars</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
