/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  supabase: any;
  showConfigModal: () => void;
  hideModal: () => void;
  editConfig: (id: string) => Promise<void>;
  showDetails: (id: string) => Promise<void>;
  hideDetailsModal: () => void;
}