/// <reference types="svelte" />
/// <reference types="vite/client" />

/** True only in the end to end tests' build (vite.config.ts). */
declare const __PK_E2E__: boolean;

declare module 'virtual:placekeepers/registry' {
  const registry: import('./registry/types.ts').Registry;
  export default registry;
}

declare module 'virtual:placekeepers/content' {
  /** Every content page's slug (its file name without ".md") mapped to its rendered HTML. */
  const pages: Record<string, string>;
  export default pages;
}

interface ImportMetaEnv {
  /** Where the published data lives. Relative paths resolve against the site base. Default "./data/". */
  readonly VITE_DATA_BASE?: string;
  /** "protomaps" (default, self hosted extract), "openfreemap" (hosted fallback), or "none". */
  readonly VITE_BASEMAP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
