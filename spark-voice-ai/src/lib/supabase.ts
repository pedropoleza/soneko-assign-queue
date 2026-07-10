import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
// Anon key (publishable). Só usada para Realtime opcional; as tabelas `spark.*`
// têm RLS deny-all, então a anon key não lê nada diretamente — todo acesso passa
// pela Edge Function spark-api com service role.
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const hasRealtime = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = hasRealtime
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
