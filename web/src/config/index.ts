// Build time settings, read from environment variables when the site is built:
//   VITE_DATA_BASE  where the published data lives (default "./data/", next to the site)
//   VITE_BASEMAP    "protomaps" (default), "openfreemap", or "none"

import { resolveDataBase } from '../data/manifest.ts';
import { basemapMode } from '../map/basemap-mode.ts';

export const config = {
  dataBase: resolveDataBase(import.meta.env.VITE_DATA_BASE, import.meta.env.BASE_URL, window.location.href),
  basemap: basemapMode(import.meta.env.VITE_BASEMAP),
  /** The site root, for links between pages. */
  siteBase: import.meta.env.BASE_URL,
};
