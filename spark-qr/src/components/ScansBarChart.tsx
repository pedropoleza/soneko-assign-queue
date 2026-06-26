// Minimalist daily bar chart. Fills the whole window with one slim bar per day
// (days without scans render as a faint baseline tick) so a single active day no
// longer stretches into one giant full-width bar.

function fillDays(byDay: Array<{ day: string; count: number }>, days: number) {
  const map = new Map(byDay.map((d) => [d.day, d.count]));
  const out: Array<{ day: string; count: number }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    out.push({ day: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export function ScansBarChart({
  byDay, days, heightClass = 'h-32',
}: {
  byDay: Array<{ day: string; count: number }>;
  days: number;
  heightClass?: string;
}) {
  const data = fillDays(byDay, days);
  const max = Math.max(...data.map((d) => d.count), 1);

  if (data.every((d) => d.count === 0)) {
    return <div className={`grid ${heightClass} place-items-center text-sm text-ink-400`}>Sem scans no período.</div>;
  }

  return (
    <div className={`flex ${heightClass} items-end gap-px`}>
      {data.map((d) => (
        <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
          {d.count > 0 ? (
            <div
              className="w-full max-w-[10px] rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600"
              style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }}
            />
          ) : (
            <div className="h-0.5 w-full max-w-[10px] rounded-full bg-ink-200" />
          )}
          <div className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-md bg-ink-900 px-2 py-0.5 text-xs text-white group-hover:block">
            {d.day.slice(8, 10)}/{d.day.slice(5, 7)} · {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}
