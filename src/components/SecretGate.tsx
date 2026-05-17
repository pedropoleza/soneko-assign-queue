import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { saveSecret } from '@/lib/config';

export function SecretGate({ onAuthed }: { onAuthed: () => void }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSubmitting(true);
    saveSecret(value.trim());
    onAuthed();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-ink-50 via-white to-brand-50/40 px-4">
      <div className="card w-full max-w-md p-6">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-100 text-brand-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink-900">Soneko Assign Queue</h1>
        <p className="mt-1 text-sm text-ink-500">
          Para acessar o painel, cole o app secret (mesmo valor usado no webhook do GHL).
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">App secret</label>
            <Input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="d83073baeace..."
              autoFocus
            />
          </div>
          <Button type="submit" loading={submitting} className="w-full">
            <KeyRound className="h-4 w-4" />
            Entrar
          </Button>
          <p className="text-[11px] text-ink-400">
            Dica: você também pode entrar passando <code className="font-mono">?secret=...</code> na URL.
          </p>
        </form>
      </div>
    </div>
  );
}
