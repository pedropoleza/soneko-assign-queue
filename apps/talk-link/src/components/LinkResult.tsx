import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import type { Link } from '@/types';
import { buildTrackedUrl, PLACEMENTS } from '@/lib/trackingUrl';
import { copyToClipboard, cn } from '@/lib/utils';
import { Badge, Button, Card, CardHeader } from './ui';

/**
 * O card que aparece depois de gerar o link. É a peça mais usada do app:
 * o cliente copia daqui e cola no Instagram, no story, no grupo.
 */
export function LinkResult({ link, onOpenDetail }: { link: Link; onOpenDetail?: (id: string) => void }) {
  const [placement, setPlacement] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  const trackedUrl = useMemo(() => {
    const preset = PLACEMENTS.find((p) => p.value === placement);
    return buildTrackedUrl(link.short_url, {
      src: preset?.value,
      medium: preset?.medium,
    });
  }, [link.short_url, placement]);

  async function copy(value: string, tag: string) {
    const ok = await copyToClipboard(value);
    if (!ok) return toast.error('Não consegui copiar. Copie manualmente.');
    setCopied(tag);
    setTimeout(() => setCopied(null), 1600);
    toast.success('Copiado');
  }

  return (
    <Card className="fade-in border-brand-200">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-brand-600" />
            {link.name}
          </span>
        }
        subtitle={link.partner_name ? `Indicação de ${link.partner_name}` : undefined}
        action={<Badge tone="brand">código {link.code}</Badge>}
      />

      <div className="space-y-4 p-5">
        <div>
          <div className="label">Link para compartilhar</div>
          <div className="flex items-stretch gap-2">
            <div className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
              <span className="block truncate font-mono text-xs text-ink-800">{trackedUrl}</span>
            </div>
            <Button variant="secondary" onClick={() => copy(trackedUrl, 'url')} className="shrink-0">
              {copied === 'url' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              Copiar
            </Button>
          </div>
          <p className="hint">
            O rastreio vai todo na URL. Quem clica cai direto no WhatsApp — não existe página no meio.
          </p>
        </div>

        <div>
          <div className="label">Onde você vai postar</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPlacement('')}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                !placement
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50',
              )}
            >
              Sem origem
            </button>
            {PLACEMENTS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPlacement(p.value === placement ? '' : p.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  placement === p.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="hint">
            Cada escolha muda só o final da URL (<code className="font-mono">?s=</code>). Dá para gerar uma
            variação por lugar e comparar depois em Métricas.
          </p>
        </div>

        <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-600">
            <MessageSquare className="h-3 w-3" />
            Mensagem que a pessoa vê
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-800">{link.message}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => copy(link.message, 'msg')}>
            {copied === 'msg' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            Copiar mensagem
          </Button>
          <a
            href={trackedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            <ExternalLink className="h-3 w-3" />
            Testar
          </a>
          {onOpenDetail && (
            <Button variant="ghost" size="sm" onClick={() => onOpenDetail(link.id)}>
              Ver métricas
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
