import { useState } from 'react';
import { KeyRound, Zap } from 'lucide-react';
import { saveSecret } from '@/config';

export function SecretGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink-900">Spark QR</div>
            <div className="text-xs text-ink-500">Painel de QR dinâmico</div>
          </div>
        </div>
        <label className="label">Secret de acesso</label>
        <div className="flex items-center gap-2">
          <input
            className="input"
            type="password"
            value={value}
            placeholder="cole o secret aqui"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { saveSecret(value); onUnlock(); } }}
          />
        </div>
        <button
          className="btn-primary mt-3 w-full"
          disabled={!value.trim()}
          onClick={() => { saveSecret(value); onUnlock(); }}
        >
          <KeyRound className="h-4 w-4" /> Entrar
        </button>
        <p className="mt-3 text-center text-[11px] text-ink-400">
          O secret fica salvo neste navegador. Também aceita <code>?secret=</code> na URL.
        </p>
      </div>
    </div>
  );
}
