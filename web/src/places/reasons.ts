// The vacancy model's reasons for a parcel, as plain sentences for the details panel.
//
// The pipeline packs them into the tile property `rs`, one bit per reason (docs/CONTRACTS.md
// section 4), with the years that go with some of them in `dy` (demolished), `sy` (sealed) and
// `ny` (new construction permit). The City lists' dates come from the manifest. Bits never
// change meaning once published, so this list only ever grows at the end.

import type { Manifest } from '../data/manifest.ts';
import { formatDate, strings } from '../strings.ts';

/** Reason ids in bit order: REASONS[bit]. */
export const REASONS = [
  'city_land',
  'city_building',
  'assessor_vacant_land',
  'no_building',
  'demolished',
  'vacant_lot_record',
  'landcare',
  'sealed',
  'unsafe',
  'imminently_dangerous',
  'vacant_building_record',
  'assessor_exterior',
  'built_since',
  'construction_starting',
  'side_yard',
  'land_use_shows_use',
  'recent_permit',
  'building_stands',
] as const;

export type ReasonId = (typeof REASONS)[number];

/** Bits from here up are reasons for doubt; the ones below say the parcel is vacant. */
export const FIRST_DOUBT_BIT = 12;

export interface ReasonContext {
  /** The City lists' dates in words, or null when unknown. */
  cityLandDate: string | null;
  cityBuildingDate: string | null;
}

export interface PlaceReasons {
  /** Sentences for the records that say the parcel is vacant. */
  agree: string[];
  /** Sentences for the records that cast doubt on it. */
  doubt: string[];
}

function whole(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** The reason ids set in `rs`, in bit order. Bits this app does not know are ignored. */
export function reasonIds(rs: unknown): ReasonId[] {
  const bits = whole(rs);
  if (bits === null) return [];
  return REASONS.filter((_, bit) => (bits & (1 << bit)) !== 0);
}

export function reasonContext(manifest: Manifest | null): ReasonContext {
  const date = (source: string) => formatDate(manifest?.sources[source]?.newest_record ?? null);
  return { cityLandDate: date('vacant_indicators_land'), cityBuildingDate: date('vacant_indicators_bldg') };
}

export function reasonSentence(id: ReasonId, properties: Record<string, unknown>, ctx: ReasonContext): string {
  const r = strings.reasons;
  const year = (key: string) => whole(properties[key]);
  switch (id) {
    case 'city_land':
      return r.city_land(ctx.cityLandDate);
    case 'city_building':
      return r.city_building(ctx.cityBuildingDate);
    case 'demolished':
      return r.demolished(year('dy'));
    case 'sealed':
      return r.sealed(year('sy'));
    case 'built_since':
      return r.built_since(year('ny'));
    case 'construction_starting':
      return r.construction_starting(year('ny'));
    default:
      return r[id];
  }
}

/** The parcel's reasons as sentences, or null when the tile carries none (an older build). */
export function placeReasons(properties: Record<string, unknown>, ctx: ReasonContext): PlaceReasons | null {
  if (whole(properties.rs) === null) return null;
  const out: PlaceReasons = { agree: [], doubt: [] };
  for (const id of reasonIds(properties.rs)) {
    const list = REASONS.indexOf(id) >= FIRST_DOUBT_BIT ? out.doubt : out.agree;
    list.push(reasonSentence(id, properties, ctx));
  }
  return out;
}
