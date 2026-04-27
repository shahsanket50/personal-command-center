import { useEffect } from 'react';

export function useKeyboard(handlers) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') handlers.escape?.(e);
        return;
      }
      handlers.any?.(e);
      handlers[e.key]?.(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
