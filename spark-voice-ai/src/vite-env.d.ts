/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPARK_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SPARK_DEFAULT_SESSION?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
