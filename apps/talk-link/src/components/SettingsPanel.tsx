import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { clearSecret } from '@/lib/config';
import type { AppState } from '@/types';
import { onlyDigits } from '@/lib/utils';
import { Button, Card, CardHeader, Field, Input } from './ui';

export function SettingsPanel({ state, onRefresh }: { state: AppState; onRefresh: () => void }) {
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
      toast.error(`Não deu para salvar: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="h-fit">
        <CardHeader title="Ajustes da conta" subtitle="Valores padrão usados por todo link novo." />
        <div className="space-y-4 p-5">
          <Field
            label="Número de destino padrão"
            hint="Precisa ser o número conectado ao GoHighLevel — é ele que recebe a mensagem e dispara o webhook."
          >
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999998888" inputMode="numeric" />
          </Field>

          <Field
            label="Domínio dos links curtos"
            hint="Aponte o CNAME desse domínio para a função wa-redirect. Sem ele, o app usa a URL da função."
          >
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="https://talk.sparkleads.com"
            />
          </Field>

          <Button onClick={save} loading={saving}>
            <Save className="h-3.5 w-3.5" />
            Salvar
          </Button>
        </div>
      </Card>

      <Card className="h-fit">
        <CardHeader title="Conexão" subtitle="Como este painel está falando com o CRM." />
        <dl className="divide-y divide-ink-100 text-sm">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <dt className="text-xs text-ink-500">Conta</dt>
            <dd className="truncate font-medium text-ink-900">{state.account.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <dt className="text-xs text-ink-500">Location ID</dt>
            <dd className="font-mono text-xs text-ink-700">{state.account.ghl_location_id}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <dt className="text-xs text-ink-500">Último evento do CRM</dt>
            <dd className="text-xs text-ink-700">
              {state.totals.last_event_at
                ? new Date(state.totals.last_event_at).toLocaleString('pt-BR')
                : 'nenhum ainda'}
            </dd>
          </div>
        </dl>
        <div className="border-t border-ink-100 px-5 py-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              clearSecret();
              window.location.reload();
            }}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Sair desta conta
          </Button>
          <p className="hint">Limpa o acesso salvo neste navegador. Você volta a entrar pelo menu do GHL.</p>
        </div>
      </Card>
    </div>
  );
}
