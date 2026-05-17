import { ArrowRight, Mail, User2 } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import type { SalesRep } from '@/types';

export function NextRepCard({ rep }: { rep: SalesRep | null }) {
  if (!rep) {
    return (
      <div className="card p-6 flex items-center justify-center text-center text-ink-500">
        <div>
          <User2 className="mx-auto h-8 w-8 text-ink-300" />
          <div className="mt-2 text-sm font-medium">Nenhum vendedor ativo</div>
          <div className="text-xs">Ative pelo menos um consultor na aba Vendedores.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card p-5 bg-gradient-to-br from-brand-50 via-white to-white">
      <div className="flex items-center justify-between mb-3">
        <Badge tone="brand">PRÓXIMO LEAD</Badge>
        <span className="text-[11px] text-ink-500">posição #{rep.position}</span>
      </div>
      <div className="flex items-center gap-4">
        <Avatar name={rep.name} src={rep.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-ink-900 truncate">{rep.name}</div>
          {rep.email && (
            <div className="flex items-center gap-1.5 text-xs text-ink-500 truncate">
              <Mail className="h-3 w-3" />
              {rep.email}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-500">
            <ArrowRight className="h-3 w-3" />
            Próximo contato criado no GHL será atribuído automaticamente
          </div>
        </div>
      </div>
    </div>
  );
}
