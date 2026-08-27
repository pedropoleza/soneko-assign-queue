import { useMemo, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import type { Partner } from '@/types';
import { pct } from '@/lib/utils';
import { Avatar, Chip, Empty } from './ui';

type SortKey = 'sends' | 'clicks' | 'rate';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'sends', label: 'Mensagens' },
  { key: 'clicks', label: 'Cliques' },
  { key: 'rate', label: 'Conversão' },
];

/**
 * A lista de influenciadores.
 *
 * Uma barra por pessoa, na mesma linguagem do gráfico de movimento: o claro é
 * quem clicou, o sólido é quem mandou mensagem. Comprimento relativo ao
 * primeiro colocado, então dá para comparar batendo o olho.
 *
 * Aqui havia uma rosca com uma paleta de várias cores. Saiu por dois motivos:
 * ela dizia o mesmo que a lista, e as cores estranhas ao app (laranja, verde)
 * pesavam a tela sem informar nada de novo. A participação de cada um virou
 * texto — mais exato e mais leve do que ângulo.
 */
export function InfluencersCard({
  partners,
  onOpen,
}: {
  partners: Partner[];
  onOpen: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>('sends');

  const ranked = useMemo(() => {
    const rate = (p: Partner) => (p.clicks > 0 ? p.sends / p.clicks : -1);
    return [...partners].sort((a, b) => {
      if (sort === 'clicks') return b.clicks - a.clicks || b.sends - a.sends;
      if (sort === 'rate') return rate(b) - rate(a) || b.sends - a.sends;
      return b.sends - a.sends || b.clicks - a.clicks;
    });
  }, [partners, sort]);

  const maxClicks = Math.max(1, ...partners.map((p) => p.clicks));
  const totalSends = partners.reduce((n, p) => n + p.sends, 0);

  if (partners.length === 0) {
    return (
      <div className="card">
        <Empty
          icon={<Users className="h-5 w-5" />}
          title="Nenhum influenciador ainda"
          description="Ele é criado junto com o primeiro link que você gerar no nome dele."
        />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">
          Influenciadores
          <span className="ml-2 font-normal text-ink-3">{partners.length}</span>
        </h2>

        <div className="flex items-center gap-1.5">
          <span className="hidden text-[11px] text-ink-3 sm:inline">ordenar por</span>
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              on={sort === s.key}
              onClick={() => setSort(s.key)}
              className="px-2.5 py-1 text-[12px]"
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {ranked.map((p, i) => (
          <li key={p.id}>
            <button
              onClick={() => onOpen(p.id)}
              className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-surface-2"
            >
              <span className="num w-3 shrink-0 text-[12px] text-ink-3">{i + 1}</span>
              <Avatar name={p.name} size="sm" />

              <div className="w-36 shrink-0 sm:w-44">
                <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-ink-3">
                  {p.links} {p.links === 1 ? 'link' : 'links'}
                  {totalSends > 0 && p.sends > 0
                    ? ` · ${Math.round((p.sends / totalSends) * 100)}% dos envios`
                    : ''}
                </div>
              </div>

              {/* Claro = clicaram, sólido = mandaram. Igual ao gráfico por dia. */}
              <div className="hidden min-w-0 flex-1 sm:block">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent/20"
                    style={{ width: `${Math.max(3, (p.clicks / maxClicks) * 100)}%` }}
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${p.clicks > 0 ? (p.sends / p.clicks) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="num shrink-0 text-right">
                <div className="text-[17px] font-semibold leading-none text-ink">{p.sends}</div>
                <div className="mt-1 whitespace-nowrap text-[11px] text-ink-3">
                  de {p.clicks} · {pct(p.sends, p.clicks)}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden items-center gap-4 border-t border-line px-5 py-2.5 text-[11px] text-ink-3 sm:flex">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-accent/20" /> clicaram
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-accent" /> mandaram mensagem
        </span>
      </div>
    </div>
  );
}
