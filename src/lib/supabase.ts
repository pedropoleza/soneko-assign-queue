import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tbziahcpkrfiksqhuhpe.supabase.co';
// Anon key (publishable). Realtime needs a real key; this one is safe to expose since
// our soneko.* tables are accessed via RPCs that gate on the app secret.
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const hasRealtime = !!SUPABASE_ANON_KEY;

export const supabase = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
