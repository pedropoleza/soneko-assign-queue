import { useEffect, useState } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { getSession } from '@/lib/config';
import { bootstrapViaSso } from '@/lib/sso';
import { Panel } from '@/Panel';

type Phase = 'booting' | 'ready' | 'noauth';

export default function App() {
  const [phase, setPhase] = useState<Phase>(getSession() ? 'ready' : 'booting');

  // Sem sessão na URL/localStorage: tenta o SSO da Custom Page do GHL.
  useEffect(() => {
    if (phase !== 'booting') return;
    let alive = true;
    bootstrapViaSso().then((ok) => {
      if (alive) setPhase(ok ? 'ready' : 'noauth');
    });
    return () => {
      alive = false;
    };
  }, [phase]);

  if (phase === 'booting') {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
        <div className="flex flex-col items-center gap-3 text-ink-500">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Mic size={22} />
          </span>
          <div className="flex items-center gap-2 text-sm">
            <Loader2 size={15} className="animate-spin" /> Conectando ao GoHighLevel…
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'noauth') {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
        <div className="card max-w-md p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Mic size={22} />
          </span>
          <h1 className="mt-4 text-lg font-bold text-ink-900">Spark Voice AI</h1>
          <p className="mt-1 text-sm text-ink-500">
            Conecte sua conta do GoHighLevel para começar a gerar áudios personalizados com voz clonada.
          </p>
          <a className="btn-primary mt-5 w-full" href="/functions/v1/spark-oauth/install">
            Conectar com GoHighLevel
          </a>
        </div>
      </div>
    );
  }

  return <Panel />;
}
