import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { clearSecret } from '@/lib/config';
import type { AppState } from '@/types';
import { formatPhone, onlyDigits } from '@/lib/utils';
import { Button, Input } from './ui';

export function SettingsPage({ state, onRefresh }: { state: AppState; onRefresh: () => void }) {
  const [phone, setPhone] = useState(state.account.whatsapp_phone ?? '');
  const [domain, setDomain] = useState(state.account.short_domain ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.saveSettings({
        whatsapp_phone: onlyDigits(phone),
        short_domain: domain.trim().replace(/\/+$/, ''),
      });
      toast.success('Ajustes salvos');
      onRefresh();
    } catch (e) {
      toast.error(`Não deu para salvar. ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Ajustes</h1>
        <p className="mt-1 text-sm text-ink-2">O que todo link novo usa por padrão.</p>
      </div>

      <div className="surface p-6 shadow-card">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Número que recebe as mensagens</span>
          <span className="mb-2.5 block text-[13px] leading-relaxed text-ink-2">
            Precisa ser o número de WhatsApp ligado ao seu CRM. É por ele que sabemos quem realmente
            mandou mensagem.
          </span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="5511999998888" />
          {onlyDigits(phone).length >= 10 && (
            <span className="mt-1.5 block text-[12px] text-ink-3">{formatPhone(phone)}</span>
          )}
        </label>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Endereço dos seus links</span>
          <span className="mb-2.5 block text-[13px] leading-relaxed text-ink-2">
            O começo de todo link que você gera. Trocar aqui muda os links já criados também.
          </span>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://talk.sparkleads.com" />
        </label>

        <Button className="mt-6" onClick={save} loading={saving}>
          <Check className="h-4 w-4" />
          Salvar
        </Button>
      </div>

      <div className="surface overflow-hidden shadow-card">
        <div className="px-6 pb-2 pt-5">
          <h2 className="text-sm font-semibold text-ink">Conexão com o CRM</h2>
        </div>
        <dl className="divide-y divide-line text-sm">
          <Row label="Conta" value={state.account.name} />
          <Row label="Identificador" value={state.account.ghl_location_id} mono />
          <Row
            label="Último aviso recebido"
            value={
              state.totals.last_event_at
                ? new Date(state.totals.last_event_at).toLocaleString('pt-BR')
                : 'nenhum ainda'
            }
          />
        </dl>
        <div className="border-t border-line px-6 py-4">
          <Button
            variant="plain"
            size="sm"
            onClick={() => {
              clearSecret();
              window.location.reload();
            }}
          >
            Sair desta conta
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3">
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className={`truncate text-[13px] text-ink ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
    </div>
  );
}
