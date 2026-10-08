// Parking problems reported with Philly Bike Action's Laser Vision app (issue #37): what the
// `parking` layer of tiles/parking.pmtiles holds (docs/CONTRACTS.md section 4) and how the map
// words it. Counts per H3 cell about a block across, never a single report: a cell shows with at
// least MIN_REPORTS reports in 12 months, and a kind's count within it only with MIN_REPORTS of
// its own (otherwise the property is absent and the map says "fewer than 5").

import type { Manifest } from '../data/manifest.ts';
import { formatDate, strings } from '../strings.ts';

/** The registry source the counts come from; its newest record is the window's last day. */
export const PARKING_SOURCE = 'pba_laser';
/** The pipeline's threshold (pipeline/src/placekeepers/publish/laser.py, MIN_REPORTS). */
export const MIN_REPORTS = 5;

export const PARKING_KINDS = ['sidewalk', 'bike_lane', 'crosswalk', 'corner', 'ramp'] as const;
export type ParkingKind = (typeof PARKING_KINDS)[number];
/** The values of the layer's `kind` setting: every kind, or one. */
export type ParkingChoice = 'all' | ParkingKind;

/** The tile property of each choice: `n` counts every report in the cell. */
export const PARKING_FIELDS: Record<ParkingChoice, string> = {
  all: 'n',
  sidewalk: 'sw',
  bike_lane: 'bl',
  crosswalk: 'cw',
  corner: 'co',
  ramp: 'rp',
};

export function isParkingChoice(value: unknown): value is ParkingChoice {
  return typeof value === 'string' && value in PARKING_FIELDS;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The first and last day counted: the last is the source's newest record in the manifest, the
 * first the day after the same date 12 months earlier (clamped to the end of a shorter month), as
 * the pipeline counts it. Null when the manifest has no date for the source.
 */
export function parkingWindow(manifest: Manifest | null | undefined): { start: string; end: string } | null {
  const end = manifest?.sources[PARKING_SOURCE]?.newest_record ?? null;
  const match = end ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(end) : null;
  if (!end || !match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const daysInMonth = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  const sameDay = Date.UTC(year - 1, month - 1, Math.min(day, daysInMonth));
  return { start: isoDay(new Date(sameDay + 86_400_000)), end };
}

/** "From October 8, 2025 to October 7, 2026", or "Over 12 months" without dates. */
export function parkingWindowText(manifest: Manifest | null | undefined): string {
  const window = parkingWindow(manifest);
  const start = formatDate(window?.start);
  const end = formatDate(window?.end);
  return start && end ? strings.parking.window(start, end) : strings.parking.windowUnknown;
}

function count(properties: Record<string, unknown>, field: string): number | null {
  const value = Number(properties[field]);
  return Number.isFinite(value) && value >= MIN_REPORTS ? Math.round(value) : null;
}

export interface ParkingView {
  /** Every report in the area. */
  total: number;
  window: string;
  /** Each kind with its count, or null when fewer than MIN_REPORTS. */
  kinds: { kind: ParkingKind; label: string; count: number | null }[];
}

/** What the details panel says about an area someone tapped. */
export function describeParking(properties: Record<string, unknown>, manifest: Manifest | null | undefined): ParkingView {
  return {
    total: count(properties, PARKING_FIELDS.all) ?? 0,
    window: parkingWindowText(manifest),
    kinds: PARKING_KINDS.map((kind) => ({
      kind,
      label: strings.parking.kinds[kind]!,
      count: count(properties, PARKING_FIELDS[kind]),
    })),
  };
}
