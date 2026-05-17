import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { supabase, hasRealtime } from '@/lib/supabase';
import type { AppState, Assignment } from '@/types';

const CACHE_KEY = 'soneko_state_cache_v2';
const POLL_INTERVAL_MS = hasRealtime ? 60_000 : 12_000;

function readCache(): AppState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(s: AppState) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function useAppState() {
  // Hydrate from cache immediately (stale-while-revalidate)
  const [state, setState] = useState<AppState | null>(() => readCache());
  const [isLoading, setIsLoading] = useState(!state);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenAssignmentIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await api.getState();
      setState(data);
      writeCache(data);
      setError(null);
      // Seed the seen set after first load so we don't toast every existing assignment on mount
      if (seenAssignmentIds.current.size === 0) {
        for (const a of data.assignments) seenAssignmentIds.current.add(a.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial + interval refresh
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Realtime: when an assignment row changes, refresh + toast on inserts
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('soneko_assignments')
      .on('postgres_changes',
          { event: '*', schema: 'soneko', table: 'assignments' },
          (payload) => {
            // INSERT means new lead arrived: refresh + proactive toast
            if (payload.eventType === 'INSERT') {
              const row = payload.new as any;
              if (!seenAssignmentIds.current.has(row.id)) {
                seenAssignmentIds.current.add(row.id);
                refresh().then(() => {
                  // Use latest state from cache to enrich the toast with rep name
                  const fresh = readCache();
                  const rep = fresh?.reps.find((r) => r.id === row.assigned_rep_id);
                  toast.success(`Novo lead atribuído${rep ? ` a ${rep.name}` : ''}`, {
                    description: row.contact_name ?? row.ghl_contact_id,
                  });
                });
              }
            } else {
              refresh();
            }
          })
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [refresh]);

  // Optimistic helpers
  const mutateAssignment = useCallback((id: string, patch: Partial<Assignment>) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, assignments: prev.assignments.map((a) => a.id === id ? { ...a, ...patch } : a) };
      writeCache(next);
      return next;
    });
  }, []);

  const mutateRep = useCallback((id: string, patch: Partial<AppState['reps'][number]>) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, reps: prev.reps.map((r) => r.id === id ? { ...r, ...patch } : r) };
      writeCache(next);
      return next;
    });
  }, []);

  return { state, error, isLoading, isRefreshing, refresh, mutateAssignment, mutateRep };
}
