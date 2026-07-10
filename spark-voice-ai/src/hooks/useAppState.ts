import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AppState } from '@/types';

export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setState(await api.getState());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro_desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, error, isLoading, refresh };
}
