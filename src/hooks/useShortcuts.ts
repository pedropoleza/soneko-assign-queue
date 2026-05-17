import { useEffect } from 'react';

type Handler = () => void;
export type Shortcut = { key: string; meta?: boolean; shift?: boolean; handler: Handler };

export function useShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      // Don't trigger shortcuts inside inputs (unless it's Escape/Cmd-K-style)
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target?.isContentEditable) {
        if (e.key !== 'Escape') return;
      }
      for (const s of shortcuts) {
        if (e.key.toLowerCase() === s.key.toLowerCase()
            && (!s.meta || e.metaKey || e.ctrlKey)
            && (!s.shift || e.shiftKey)) {
          e.preventDefault();
          s.handler();
          return;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts]);
}
