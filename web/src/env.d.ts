/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module 'virtual:placekeepers/registry' {
  const registry: import('./registry/types.ts').Registry;
  export default registry;
}

interface ImportMetaEnv {
  /** Where the published data lives. Relative paths resolve against the site base. Default "./data/". */
  readonly VITE_DATA_BASE?: string;
  /** "protomaps" (default, self hosted extract), "openfreemap" (hosted fallback), or "none". */
  readonly VITE_BASEMAP?: string;
  /** The address that takes memorial removal requests (an owner action). Empty: a GitHub issue. */
  readonly VITE_TAKEDOWN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
