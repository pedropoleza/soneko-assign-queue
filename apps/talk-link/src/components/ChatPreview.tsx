import { Check, Lock } from 'lucide-react';

/**
 * A conversa como o lead vai ver.
 *
 * Este é o único jeito honesto de explicar o rastreio invisível para quem não é
 * técnico: mostramos a mensagem exatamente como ela chega, e não há nada de
 * estranho nela. O código viaja em caracteres de largura zero, que por definição
 * não ocupam espaço nenhum aqui.
 */
export function ChatPreview({
  message,
  businessName,
  time = '09:41',
}: {
  message: string;
  businessName: string;
  time?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-2.5 border-b border-line bg-surface-2 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-deep">
          {businessName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">{businessName}</div>
          <div className="text-[11px] text-ink-3">online</div>
        </div>
      </div>

      <div className="chat-paper px-4 pb-7 pt-5">
        <div className="ml-auto max-w-[85%]">
          <div className="relative rounded-2xl rounded-tr-md bg-chat-bubble px-3.5 py-2.5 shadow-sm">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.45] text-chat-ink">
              {message || 'A mensagem aparece aqui…'}
            </p>
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-chat-ink/55">
              {time}
              <Check className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[11px] text-ink-3">
        <Lock className="h-3 w-3" />
        Nada aqui denuncia o rastreio — o código viaja invisível dentro do texto.
      </div>
    </div>
  );
}
