import { useState } from 'react';
import { Copy, ExternalLink, LogOut, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { API_URL, clearSecret } from '@/lib/config';
import type { AppState } from '@/types';

export function SettingsPage({ state }: { state: AppState }) {
  const [revealSecret, setRevealSecret] = useState(false);
  const webhookUrl = API_URL.replace('/soneko-api', '/soneko-ghl-webhook');

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  }

  function logout() {
    clearSecret();
    window.location.reload();
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700">
            <Webhook className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-ink-900">Integração com GHL</h2>
        </div>
        <p className="text-xs text-ink-500 mb-4">
          Cole estes valores no Workflow Builder do GHL (action <em>Webhook</em>) para que cada contato
          criado dispare a atribuição automática.
        </p>

        <Field label="Webhook URL" value={webhookUrl} onCopy={() => copy(webhookUrl, 'Webhook URL')} />
        <Field
          label="Custom Header"
          value="x-soneko-secret: <app secret>"
          onCopy={() => copy('x-soneko-secret', 'Header name')}
        />
        <Field
          label="GHL Location ID"
          value={state.location.ghl_location_id}
          onCopy={() => copy(state.location.ghl_location_id, 'Location ID')}
        />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-900 mb-3">Custom Menu Link (embed no GHL)</h2>
        <p className="text-xs text-ink-500 mb-3">
          Em <em>Settings → Custom Menu Links</em> dentro da subconta, adicione um link apontando para a URL
          deste painel. O secret fica salvo no navegador da subconta.
        </p>
        <Field
          label="URL do painel (com secret pré-preenchido)"
          value={typeof window !== 'undefined' ? `${window.location.origin}/?secret=…` : '/?secret=…'}
          onCopy={() => copy(window.location.origin + '/', 'URL do painel')}
        />
        <a
          href="https://app.gohighlevel.com/v2/location/settings/custom-menu"
          target="_top"
          className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
        >
          Abrir Custom Menu Links no GHL <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-900 mb-3">Acesso</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-ink-600">
            Você está autenticado com o app secret desta location.
            <button onClick={() => setRevealSecret((v) => !v)} className="ml-2 text-brand-600 hover:underline">
              {revealSecret ? 'Ocultar' : 'Revelar'}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
        {revealSecret && (
          <pre className="mt-3 rounded-md bg-ink-900 px-3 py-2 text-[11px] text-ink-100 overflow-x-auto">
            {localStorage.getItem('soneko_secret')}
          </pre>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-500">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-800">
          {value}
        </code>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2.5 text-xs text-ink-700 hover:bg-ink-50"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar
        </button>
      </div>
    </div>
  );
}
