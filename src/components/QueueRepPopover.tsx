import { useState, type ReactNode } from 'react';
import * as RPopover from '@radix-ui/react-popover';
import { toast } from 'sonner';
import { ArrowRight, Ban, CheckCircle2, Clock, Plane, RotateCw, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar } from './ui/Avatar';
import { cn } from '@/lib/utils';
import type { Assignment, SalesRep } from '@/types';

export function QueueRepPopover({
  trigger,
  rep,
  isNext,
  recentAssignment,
  onAction,
  onSkipAssignment,
}: {
  trigger: ReactNode;
  rep: SalesRep;
  isNext: boolean;
  recentAssignment: Assignment | null;
  onAction: () => void;
  onSkipAssignment: (a: Assignment, targetRepId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const unavailableReason = !rep.active ? 'Inativo'
    : rep.vacation_start && rep.vacation_end
      && new Date(rep.vacation_start) <= new Date() && new Date(rep.vacation_end) >= new Date()
    ? 'Em férias'
    : rep.working_hours_start && rep.working_hours_end && !rep.available
    ? `Fora do horário (${rep.working_hours_start.slice(0,5)}–${rep.working_hours_end.slice(0,5)})`
    : null;

  async function setNext() {
    setBusy('next');
    try {
      await api.setNextRep(rep.id);
      toast.success(`${rep.name} agora é o próximo da fila`);
      setOpen(false);
      onAction();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function advance() {
    setBusy('advance');
    try {
      const res = await api.advanceQueue();
      toast.success(`Fila avançou para ${res.next_rep.name}`);
      setOpen(false);
      onAction();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  function reassignLast() {
    if (!recentAssignment) return;
    onSkipAssignment(recentAssignment, rep.id);
    setOpen(false);
  }

  async function toggleActive() {
    setBusy('toggle');
    try {
      await api.toggleRep(rep.id, !rep.active);
      toast.success(`${rep.name} ${!rep.active ? 'reativado' : 'inativado'} para receber leads`);
      setOpen(false);
      onAction();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  const canSetNext = !isNext && !unavailableReason;
  const minsSinceLast = recentAssignment
    ? Math.round((Date.now() - new Date(recentAssignment.created_at).getTime()) / 60000)
    : null;
  const showReassign = recentAssignment && minsSinceLast !== null && minsSinceLast <= 30;

  return (
    <RPopover.Root open={open} onOpenChange={setOpen}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content
          side="bottom"
          align="center"
          sideOffset={8}
          className="z-50 w-72 rounded-xl border border-ink-200 bg-white p-3 shadow-xl animate-in fade-in"
        >
          <div className="flex items-center gap-3 pb-2 border-b border-ink-100">
            <Avatar name={rep.name} src={rep.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink-900 truncate">{rep.name}</div>
              <div className="text-[11px] text-ink-500">
                {rep.recent_leads} leads/7d · peso {rep.weight}x
                {isNext && <span className="ml-1.5 text-brand-700 font-medium">· próximo</span>}
              </div>
            </div>
          </div>

          {unavailableReason && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
              {unavailableReason.startsWith('Em') ? <Plane className="h-3 w-3" />
                : unavailableReason.startsWith('Fora') ? <Clock className="h-3 w-3" />
                : null}
              {unavailableReason}
            </div>
          )}

          <div className="mt-2 space-y-1">
            <ActionRow
              icon={<Target className="h-4 w-4" />}
              label="Definir como próximo"
              hint={isNext ? 'Já é o próximo' : unavailableReason ? 'Indisponível' : 'Próximo lead vai pra este vendedor'}
              onClick={setNext}
              disabled={!canSetNext}
              loading={busy === 'next'}
            />
            {isNext && (
              <ActionRow
                icon={<ArrowRight className="h-4 w-4" />}
                label="Avançar fila um"
                hint="Pula este vendedor sem precisar de lead"
                onClick={advance}
                loading={busy === 'advance'}
              />
            )}
            {showReassign && (
              <ActionRow
                icon={<RotateCw className="h-4 w-4" />}
                label={`Reatribuir último lead`}
                hint={`${recentAssignment?.contact_name ?? recentAssignment?.ghl_contact_id} · há ${minsSinceLast} min`}
                onClick={reassignLast}
              />
            )}

            <div className="my-1 border-t border-ink-100" />
            <ActionRow
              icon={rep.active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              label={rep.active ? 'Inativar para receber leads' : 'Reativar para receber leads'}
              hint={rep.active ? 'Sai da fila até ser reativado' : 'Volta a entrar na rotação'}
              onClick={toggleActive}
              loading={busy === 'toggle'}
              danger={rep.active}
            />
          </div>

          <RPopover.Arrow className="fill-white stroke-ink-200" />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

function ActionRow({
  icon, label, hint, onClick, disabled, loading, danger,
}: {
  icon: ReactNode; label: string; hint?: string;
  onClick: () => void; disabled?: boolean; loading?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
        'disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed',
        danger ? 'hover:bg-rose-50' : 'hover:bg-brand-50',
      )}
    >
      <span className={cn(
        'mt-0.5 grid h-6 w-6 place-items-center rounded-md transition-colors',
        danger
          ? 'bg-rose-100 text-rose-600 group-hover:bg-rose-200'
          : 'bg-ink-100 text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700',
      )}>
        {loading ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn('text-[13px] font-medium', danger ? 'text-rose-700' : 'text-ink-900')}>{label}</div>
        {hint && <div className="text-[11px] text-ink-500 truncate">{hint}</div>}
      </div>
    </button>
  );
}
