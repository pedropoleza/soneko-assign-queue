import { Construction } from 'lucide-react';

// Placeholder consistente para as telas ainda em construção nas próximas etapas.
export function Placeholder({ title, stage, children }: { title: string; stage: string; children?: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span className="pill-brand">{stage}</span>
      </div>
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <Construction size={28} className="text-ink-300" />
        <div className="max-w-md text-sm text-ink-500">
          {children ?? 'Tela em construção — será entregue na etapa indicada.'}
        </div>
      </div>
    </div>
  );
}
