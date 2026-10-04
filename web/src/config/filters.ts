// Filters shown in the analysis view. They narrow what a layer shows by a tile property
// from docs/CONTRACTS.md section 4. The registry does not define filters yet, so they live
// here; each one names the style it applies to and the property it reads.

import { strings } from '../strings.ts';
import type { StyleId } from '../map/styles/ids.ts';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  id: string;
  label: string;
  /** Layers drawn with this style are filtered. */
  style: StyleId;
  /** Integer tile property compared against the selected values. */
  property: string;
  options: FilterOption[];
}

/** Owner type codes from CONTRACTS.md section 4, in the order people expect to read them. */
const OWNER_TYPE_ORDER = [1, 2, 7, 3, 4, 5, 6, 8, 0];

export const FILTERS: FilterDef[] = [
  {
    id: 'owner_type',
    label: strings.filters.ownerType,
    style: 'vacant_parcels',
    property: 'ot',
    options: OWNER_TYPE_ORDER.map((code) => ({ value: String(code), label: strings.ownerTypes[code] ?? String(code) })),
  },
];
