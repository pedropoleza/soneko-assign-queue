import { Check, Lock } from 'lucide-react';

/**
 * A conversa como o lead vai ver.
 *
 * É o único jeito honesto de explicar o rastreio invisível para quem não é
 * técnico: mostramos a mensagem exatamente como ela chega, e não há nada de
 * estranho nela. O código viaja em caracteres de largura zero, que por
 * definição não ocupam espaço nenhum aqui.
 */
export function ChatPreview({
  message,
  time = '09:41',
}: {
  message: string;
  time?: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="chat-paper px-4 pb-7 pt-5">
        <div className="ml-auto max-w-[88%]">
          <div className="rounded-xl rounded-tr-md bg-chat-bubble px-3.5 py-2.5 shadow-sm">
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

      <div className="flex items-start gap-2 border-t border-line px-4 py-2.5 text-[11px] leading-snug text-ink-3">
        <Lock className="mt-px h-3 w-3 shrink-0" />
        Nada aqui denuncia o rastreio — o código viaja invisível dentro do texto.
      </div>
    </div>
  );
}
