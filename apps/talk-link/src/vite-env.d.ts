/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TALK_API_URL?: string;
  readonly VITE_TALK_OAUTH_URL?: string;
  readonly VITE_TALK_SHORT_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
