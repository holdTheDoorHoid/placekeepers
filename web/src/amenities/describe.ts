// What the map says about an amenity from OpenStreetMap, a public place from the City, or a block
// with conditions reported to 311 (M3.5): plain sentences built from the tile properties of
// docs/CONTRACTS.md section 4, kept apart from the components so the wording can be tested.
// Unknown is never worded as no; 311 blocks never name an address or anyone who reported.

import { formatDate, strings } from '../strings.ts';
import { titleStreet } from '../streets/describe.ts';
import { osmUrl } from '../transit/amenities.ts';

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// Amenities from OpenStreetMap ------------------------------------------------------------------

export interface AmenityView {
  title: string;
  name: string | null;
  facts: string[];
  osmUrl: string | null;
}

/** The yes or no answers each amenity can carry, in the order they are listed. */
const ANSWERS = ['br', 'cv', 'bt', 'sn', 'in', 'fee', 'ct'] as const;

export function describeAmenity(layerId: string, properties: Record<string, unknown>): AmenityView {
  const t = strings.amenities;
  const facts: string[] = [];
  const access = int(properties.ac);
  if (access !== null && t.access[access]) facts.push(t.access[access]!);
  for (const key of ANSWERS) {
    const value = int(properties[key]);
    const words = t.facts[key];
    if (words && (value === 1 || value === 0)) facts.push(words[value === 1 ? 0 : 1]);
  }
  const wheelchair = int(properties.wc);
  if (wheelchair !== null && t.wheelchair[wheelchair]) facts.push(t.wheelchair[wheelchair]!);
  const hours = text(properties.oh);
  if (hours) facts.push(t.hours(hours));
  return {
    title: t.titles[layerId] ?? strings.streets.detailsTitle('amenity'),
    name: text(properties.nm),
    facts,
    osmUrl: osmUrl(properties.id),
  };
}

// Public places from the City -------------------------------------------------------------------

export interface PlaceView {
  title: string;
  kind: string | null;
  facts: string[];
  link: { href: string; label: string } | null;
  source: string;
}

/** Only the Free Library's own pages are linked (the pipeline keeps no other). */
const LIBRARY_PAGE = /^https:\/\/(libwww|www)\.freelibrary\.org\//;

export function describePlace(layerId: string, properties: Record<string, unknown>): PlaceView {
  const t = strings.places;
  const facts: string[] = [];
  const name = text(properties.nm) ?? '';
  const k = int(properties.k);
  let kind: string | null = null;
  let link: PlaceView['link'] = null;
  if (layerId === 'libraries') {
    kind = strings.places.legend.libraries ?? null;
    const address = [text(properties.ad), text(properties.zip)].filter(Boolean).join(', Philadelphia, PA ');
    if (address) facts.push(address);
    const phone = text(properties.ph);
    if (phone) facts.push(t.phone(phone));
    const url = text(properties.url);
    if (url && LIBRARY_PAGE.test(url)) link = { href: url, label: t.libraryPage };
  } else if (layerId === 'recreation_centers') {
    kind = (k !== null && t.recreationKinds[k]) || t.recreationKinds[1]!;
    if (int(properties.gym) === 1) facts.push(t.gym);
    if (int(properties.bd) === 0) facts.push(t.noBuilding);
  } else if (layerId === 'pools') {
    kind = (k !== null && t.poolKinds[k]) || t.poolKinds[1]!;
    const status = int(properties.st);
    facts.push(status === 1 || status === 0 ? t.status[status]! : t.statusUnknown);
    const indoor = int(properties.in);
    if (indoor === 1 || indoor === 0) facts.push(t.indoor[indoor]!);
    const opened = formatDate(text(properties.op));
    if (opened && status === 1) facts.push(t.opened(opened));
    const access = int(properties.ada);
    if (access === 1 || access === 0) facts.push(t.accessible[access]!);
    const address = text(properties.ad);
    if (address) facts.unshift(titleStreet(address));
  } else if (layerId === 'park_water') {
    kind = (k !== null && t.waterKinds[k]) || t.waterKinds[1]!;
    const park = text(properties.pk);
    if (park) facts.push(t.inPark(park));
    if (int(properties.in) === 1) facts.push(t.waterIndoor);
  }
  return {
    title: name || kind || strings.streets.detailsTitle('public_place'),
    kind: name ? kind : null,
    facts,
    link,
    source: layerId === 'libraries' ? t.source.libraries! : t.source.parks!,
  };
}

// Conditions reported to 311 --------------------------------------------------------------------

export interface ConditionView {
  title: string;
  place: string | null;
  summary: string;
  facts: string[];
}

export function describeCondition(layerId: string, properties: Record<string, unknown>): ConditionView {
  const t = strings.conditions;
  const n = int(properties.n) ?? 0;
  const open = int(properties.o) ?? 0;
  const facts: string[] = [];
  const newest = formatDate(text(properties.d));
  if (newest) facts.push(t.newest(newest));
  const alley = int(properties.a) ?? 0;
  if (alley > 0) facts.push(t.alley(alley, n));
  const street = text(properties.name);
  return {
    title: t.titles[layerId] ?? strings.streets.detailsTitle('condition'),
    place: street ? t.block(titleStreet(street)) : null,
    summary: t.summary(n, open),
    facts,
  };
}
