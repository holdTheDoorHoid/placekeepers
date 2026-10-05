// The primary chips in the field view (docs/DESIGN.md section 4). Each chip is a shortcut that
// switches a set of registry layers on or off together. A chip whose layers are not in the
// registry yet is shown as "coming soon" instead of doing nothing silently.

import { strings } from '../strings.ts';

export interface ChipDef {
  id: string;
  label: string;
  /** Registry layer ids this chip controls. Ids missing from the registry are skipped. */
  layers: string[];
  /** Shown when none of the layers exist yet. */
  soon?: string;
}

export const FIELD_CHIPS: ChipDef[] = [
  { id: 'lots', label: strings.chips.lots, layers: ['vacant_parcels'] },
  { id: 'streets', label: strings.chips.streets, layers: ['hin_2025'] },
  { id: 'memorials', label: strings.chips.memorials, layers: ['memorials'] },
  // SEPTA's bus and trolley stops, colored by the transit comfort lens (M2.3).
  { id: 'stops', label: strings.chips.stops, layers: ['transit_stops'] },
];
