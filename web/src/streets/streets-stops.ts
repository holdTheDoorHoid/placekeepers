// What the map says about a City bus shelter, a street pole, a traffic calming device or a school
// crossing guard post someone tapped (M4.5, issue #41), and the lines they add to a street block,
// a memorial, a 311 street light block and a stop. Built from the tile properties of
// docs/CONTRACTS.md section 4. Kept apart from the components so the wording can be tested.
//
// Poles are "poles" and lamps "lamps the City lists": what is installed, never whether a street is
// lit or how bright it is. Crossing guards are a safety service, never enforcement.

import { formatDate, strings } from '../strings.ts';
import { titleStreet } from './describe.ts';

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export interface SmallView {
  title: string;
  lines: string[];
  source: string;
}

/** The SEPTA stop number in a Placekeepers stop key ("sp21261" is stop 21261). */
function stopNumber(key: string | null): string | null {
  const found = key ? /^s[pr](\d+)/.exec(key) : null;
  return found ? found[1]! : null;
}

export function describeShelter(properties: Record<string, unknown>): SmallView {
  const t = strings.streetsStops;
  const lines: string[] = [];
  const stop = stopNumber(text(properties.st));
  const how = int(properties.m);
  if (stop) {
    lines.push(t.shelterAt(stop));
    lines.push(how === 1 ? t.shelterByNumber : t.shelterByPlace);
    lines.push(t.shelterLens);
  } else {
    lines.push(t.shelterNoStop);
  }
  const listed = text(properties.sid);
  if (listed && (!stop || listed !== stop)) lines.push(t.shelterListed(listed));
  if (int(properties.dg) === 1) lines.push(t.shelterDigital);
  lines.push(t.shelterPartner);
  return { title: text(properties.nm) ?? t.shelterTitle, lines, source: t.shelterSource };
}

export function describePole(properties: Record<string, unknown>): SmallView {
  const t = strings.streetsStops;
  const number = int(properties.id);
  const lines = [t.poleKind[int(properties.k) ?? 0] ?? t.poleKind[0]!];
  const owner = int(properties.o);
  if (owner !== null && t.poleOwner[owner]) lines.push(t.poleOwner[owner]!);
  lines.push(number === null ? t.poleReportNoNumber : t.poleReport(String(number)));
  return { title: t.poleTitle(number === null ? null : String(number)), lines, source: t.poleSource };
}

export function describeCalming(properties: Record<string, unknown>): SmallView {
  const t = strings.streetsStops;
  const lines: string[] = [t.calmingWhat];
  const street = text(properties.name);
  const day = formatDate(text(properties.d));
  if (day) lines.push(t.calmingSince(day));
  return { title: street ? t.calmingOn(titleStreet(street)) : t.calmingTitle, lines, source: t.calmingSource };
}

export function describeGuard(properties: Record<string, unknown>): SmallView {
  const t = strings.streetsStops;
  const lines: string[] = [t.guardHere];
  const corner = text(properties.pl);
  const school = text(properties.sn);
  if (school) lines.push(t.guardSchool(school));
  lines.push(t.guardWhat);
  return { title: corner ?? t.guardTitle, lines, source: t.guardSource };
}

/** The poles line of a street block (`pl`, `lp`, `le`), or null when the block has no count. */
export function blockPolesLine(properties: Record<string, unknown>): string | null {
  const poles = int(properties.pl);
  if (poles === null) return null;
  if (poles === 0) return strings.streetsStops.blockNoPoles;
  return strings.streetsStops.blockPoles(poles, int(properties.lp) ?? 0, int(properties.le) ?? 0);
}

export interface CalmingLines {
  line: string;
  /** On a street the City's program does not serve: what to do instead. */
  arterial: string | null;
}

/**
 * The traffic calming line of a street block: the devices the City lists and since when (`tc`,
 * `ty`), or, on a High Injury Network block where people were hurt (`tc` 0), that none is recorded
 * yet, with what to do on a street the program does not serve (no `sg`). Null otherwise.
 */
export function blockCalming(properties: Record<string, unknown>): CalmingLines | null {
  const devices = int(properties.tc);
  if (devices === null) return null;
  const t = strings.streetsStops;
  if (devices > 0) return { line: t.blockCalming(devices, int(properties.ty)), arterial: null };
  const asks = String(properties.sg ?? '').split(',').includes('traffic_calming_petition');
  return { line: t.blockNoCalming, arterial: asks ? null : t.blockArterial };
}

/** Beside a memorial's traffic calming request: what the City lists on its block (`tc`, `ty`). */
export function memorialCalmingLine(properties: Record<string, unknown>): string | null {
  const devices = int(properties.tc);
  if (devices === null) return null;
  const t = strings.streetsStops;
  return devices > 0 ? t.memorialCalming(devices, int(properties.ty)) : t.memorialNoCalming;
}

/** Beside a street light reported out: the poles the City lists along the block. */
export function lightsPolesLine(properties: Record<string, unknown>): string | null {
  const poles = int(properties.pl);
  if (poles === null || poles === 0) return null;
  return strings.streetsStops.lightsPoles(poles, int(properties.lp) ?? 0, int(properties.le) ?? 0);
}

/** The lamps the City lists by a stop (`lp`, `le`), or null without a count. */
export function stopLampsLine(properties: Record<string, unknown>): string | null {
  const lamps = int(properties.lp);
  if (lamps === null) return null;
  return strings.streetsStops.stopLamps(lamps, int(properties.le) ?? 0);
}
