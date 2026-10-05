// Filters shown in the analysis view, as chips. They narrow what a layer shows (and so the ranked
// list, the plot and the places nearby) by a tile property from docs/CONTRACTS.md section 4. The
// registry does not define filters, so they live here; each one names the style it applies to and
// the property it reads. Two more chip groups in the same panel set the lots layer's own registry
// settings (how sure we are, and lots or buildings), so each idea has one control and one place in
// the link.
//
// Filter ids and option values appear in shared links (`f=`), so they never change once published.

import { strings } from '../strings.ts';
import type { StyleId } from '../map/styles/ids.ts';
import { PERMISSION_CODES } from './permission.ts';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  id: string;
  label: string;
  /** A sentence under the chips, when the filter needs one. */
  help?: string;
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
  {
    id: 'landcare',
    label: strings.filters.landcare,
    style: 'vacant_parcels',
    property: 'lc',
    options: [
      { value: '1', label: strings.filters.inLandcare },
      { value: '0', label: strings.filters.notInLandcare },
    ],
  },
  {
    // A category, never a score: shown in the fixed order of its codes (src/config/permission.ts).
    id: 'first_step',
    label: strings.permission.title,
    help: strings.permission.filterHelp,
    style: 'vacant_parcels',
    property: 'rt',
    options: PERMISSION_CODES.map((code) => ({ value: String(code), label: strings.permission.short[code] })),
  },
];

/** A chip group that sets one registry setting of a layer instead of a filter. */
export interface SettingChips {
  layer: string;
  setting: string;
  label: string;
}

export const SETTING_CHIPS: SettingChips[] = [
  { layer: 'vacant_parcels', setting: 'min_confidence', label: strings.filters.confidence },
  { layer: 'vacant_parcels', setting: 'kinds', label: strings.filters.kind },
];

/** True when a filter narrows anything (some but not every option chosen). */
export function filterNarrows(filter: FilterDef, chosen: readonly string[] | undefined): boolean {
  return chosen !== undefined && chosen.length < filter.options.length;
}
