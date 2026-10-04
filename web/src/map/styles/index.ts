// Every style the web app implements, keyed by the registry `style` id (see ./ids.ts).
// TypeScript checks that this map covers exactly the ids in STYLE_IDS.

import type { Layer } from '../../registry/types.ts';
import { crashes } from './crashes.ts';
import { hin } from './hin.ts';
import type { StyleId } from './ids.ts';
import { memorials } from './memorials.ts';
import { shootingsHex } from './shootings_hex.ts';
import { streetSegments } from './street_segments.ts';
import type { StyleModule } from './types.ts';
import { vacantParcels } from './vacant_parcels.ts';

export const STYLES: Record<StyleId, StyleModule> = {
  vacant_parcels: vacantParcels,
  hin,
  shootings_hex: shootingsHex,
  street_segments: streetSegments,
  crashes,
  memorials,
};

export function styleFor(layer: Layer): StyleModule | null {
  return (STYLES as Record<string, StyleModule | undefined>)[layer.style] ?? null;
}

export { partId } from './types.ts';
export type { LegendEntry, StyleContext, StyleModule } from './types.ts';
