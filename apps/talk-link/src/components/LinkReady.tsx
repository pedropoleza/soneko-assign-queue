import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Link } from '@/types';
import { buildTrackedUrl, PLACEMENTS } from '@/lib/trackingUrl';
import { copyToClipboard } from '@/lib/utils';
import { Button, Chip } from './ui';
import { ChatPreview } from './ChatPreview';

/**
 * A tela de "pronto". Substitui o formulário em vez de aparecer ao lado dele:
 * criado o link, a única coisa que importa é copiar e ir postar.
 */
export function LinkReady({
  link,
  businessName,
  onNew,
  onSeeResults,
}: {
  link: Link;
  businessName: string;
  onNew: () => void;
  onSeeResults: () => void;
}) {
  const [placement, setPlacement] = useState('');
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const p = PLACEMENTS.find((x) => x.value === placement);
    return buildTrackedUrl(link.short_url, { src: p?.value, medium: p?.medium });
  }, [link.short_url, placement]);

  const pretty = url.replace(/^https?:\/\//, '');

  async function copy() {
    if (!(await copyToClipboard(url))) return toast.error('Não consegui copiar. Selecione e copie à mão.');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast.success('Link copiado');
  }

  return (
    <div className="rise mx-auto max-w-2xl">
      <div className="card overflow-hidden shadow-lift">
        <div className="border-b border-line px-6 py-6 text-center sm:px-8">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-deep">
            <Check className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <h1 className="text-xl font-semibold text-ink">Link pronto</h1>
          <p className="mt-1 text-sm text-ink-2">
            {link.partner_name ? (
              <>
                Indicação de <strong className="font-semibold text-ink">{link.partner_name}</strong> ·{' '}
                {link.name}
              </>
            ) : (
              link.name
            )}
          </p>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-surface-2 px-4 py-3">
                <span className="truncate font-mono text-[13px] text-ink">{pretty}</span>
              </div>
              <Button onClick={copy} className="sm:w-auto">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-ink-3">
              Quem clicar cai direto na conversa, sem passar por página nenhuma.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-2.5">Onde você vai postar?</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={!placement} onClick={() => setPlacement('')} className="px-3 py-1.5 text-[13px]">
                Não marcar
              </Chip>
              {PLACEMENTS.map((p) => (
                <Chip
                  key={p.value}
                  on={placement === p.value}
                  onClick={() => setPlacement(p.value === placement ? '' : p.value)}
                  className="px-3 py-1.5 text-[13px]"
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-3">
              Muda só o fim do endereço. Depois você compara qual lugar trouxe mais gente.
            </p>
          </div>

          <ChatPreview message={link.message} businessName={businessName} phone={link.destination_phone} />
        </div>

        <div className="flex flex-col gap-2 border-t border-line px-6 py-4 sm:flex-row sm:px-8">
          <Button variant="quiet" onClick={onNew} className="sm:w-auto">
            <Plus className="h-4 w-4" />
            Criar outro
          </Button>
          <Button variant="plain" onClick={onSeeResults} className="sm:w-auto">
            Ver resultados
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink sm:ml-auto sm:w-auto"
          >
            Testar o link
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
