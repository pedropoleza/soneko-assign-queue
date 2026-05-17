/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SONEKO_API_URL?: string;
  readonly VITE_SONEKO_DEFAULT_SECRET?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
