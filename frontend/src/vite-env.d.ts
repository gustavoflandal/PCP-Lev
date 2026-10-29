/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injetadas pelo Vite (vite.config.ts): versao, commit e data/hora da publicacao. */
declare const __APP_VERSAO__: string;
declare const __APP_COMMIT__: string;
declare const __APP_PUBLICADO_EM__: string;
