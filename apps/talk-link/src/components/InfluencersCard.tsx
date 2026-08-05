import { useMemo, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import type { Partner } from '@/types';
import { pct } from '@/lib/utils';
import { Donut, SERIES, SeriesDot, type Slice } from './Donut';
import { Avatar, Chip, Empty } from './ui';

type SortKey = 'sends' | 'clicks' | 'rate';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'sends', label: 'Mais mensagens' },
  { key: 'clicks', label: 'Mais cliques' },
  { key: 'rate', label: 'Melhor conversão' },
];

/**
 * A seção dos influenciadores.
 *
 * Duas perguntas, dois recursos: a rosca responde "quem trouxe o volume"
 * (participação), a lista responde "como cada um se sai" (comparação de
 * grandeza — barra, que o olho compara melhor que ângulo). As três primeiras
 * cores da rosca reaparecem na lista, então legenda e ranking são a mesma coisa.
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

  // A rosca sempre reflete participação nas mensagens, independente da ordenação.
  const bySends = useMemo(
    () => [...partners].sort((a, b) => b.sends - a.sends || b.clicks - a.clicks),
    [partners],
  );
  const totalSends = bySends.reduce((n, p) => n + p.sends, 0);

  const slices: Slice[] = useMemo(() => {
    const top = bySends.filter((p) => p.sends > 0).slice(0, SERIES.length);
    const rest = bySends.filter((p) => p.sends > 0).slice(SERIES.length);
    const out: Slice[] = top.map((p) => ({ id: p.id, label: p.name, value: p.sends }));
    const restTotal = rest.reduce((n, p) => n + p.sends, 0);
    if (restTotal > 0) {
      out.push({ id: '__outros', label: `Outros ${rest.length}`, value: restTotal });
    }
    return out;
  }, [bySends]);

  const colorOf = (id: string) => {
    const i = slices.findIndex((s) => s.id === id);
    return i >= 0 && i < SERIES.length ? i : -1;
  };

  const maxClicks = Math.max(1, ...partners.map((p) => p.clicks));

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
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Influenciadores</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">
            {partners.length} cadastrados · ordenado por {SORTS.find((s) => s.key === sort)?.label.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              on={sort === s.key}
              onClick={() => setSort(s.key)}
              className="px-3 py-1.5 text-[12px]"
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-6 border-t border-line px-5 py-5 lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-8">
        {/* Participação nas mensagens confirmadas. */}
        <div className="flex flex-col items-center gap-3 lg:items-start">
          <Donut slices={slices} total={totalSends} caption="mensagens" />
          {slices.length > 0 && (
            <ul className="w-full space-y-1.5">
              {slices.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 text-[12px]">
                  <SeriesDot index={i} />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
                  <span className="num shrink-0 font-medium text-ink">
                    {totalSends > 0 ? `${Math.round((s.value / totalSends) * 100)}%` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Desempenho de cada um. */}
        <ul className="-mx-2 divide-y divide-line">
          {ranked.map((p, i) => {
            const slot = colorOf(p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => onOpen(p.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-surface-2"
                >
                  <span className="num w-4 shrink-0 text-[12px] font-medium text-ink-3">{i + 1}</span>
                  <Avatar name={p.name} size="sm" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {slot >= 0 && <SeriesDot index={slot} />}
                      <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-ink-3">
                      {p.links} {p.links === 1 ? 'link' : 'links'}
                      {p.handle ? ` · ${p.handle}` : ''}
                    </div>
                  </div>

                  {/* Barra: o total de cliques, com a parte que virou mensagem preenchida. */}
                  <div
                    className="hidden h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-surface-2 sm:block lg:w-32"
                    title={`${p.clicks} cliques · ${p.sends} mandaram`}
                  >
                    <div
                      className="h-full rounded-full bg-accent/25"
                      style={{ width: `${Math.max(3, (p.clicks / maxClicks) * 100)}%` }}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${p.clicks > 0 ? (p.sends / p.clicks) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="num shrink-0 text-right">
                    <div className="text-base font-semibold leading-none text-ink">
                      {p.sends}
                      <span className="ml-1 text-[12px] font-normal text-ink-3">de {p.clicks}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-ink-3">{pct(p.sends, p.clicks)} conversão</div>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
