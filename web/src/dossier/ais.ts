// Address search with the City's address service (AIS): https://api.phila.gov/ais/v1/search/<text>,
// which answers browsers without a key. It understands addresses ("1234 Market St"),
// intersections ("Broad and Girard") and OPA accounts. The typed text only ever goes into this
// one address, encoded; it never reaches a database query. A result's OPA account is checked to
// be nine digits before anything else uses it.

import { PHILLY_BOUNDS } from '../state/defaults.ts';
import { fetchJson, type FailReason, type FetchOptions } from './http.ts';
import { normalizeAccount } from './opa.ts';

export const AIS_SEARCH_URL = 'https://api.phila.gov/ais/v1/search/';

/** Longer text is cut to this many characters before it is sent. */
export const MAX_SEARCH_LENGTH = 100;

/** At most this many results are offered to choose from. */
export const MAX_RESULTS = 6;

export interface SearchResult {
  kind: 'address' | 'intersection';
  /** As the City writes it, such as "1234 MARKET ST" or "N BROAD ST & W GIRARD AVE". */
  label: string;
  /** The property's OPA account, when the City knows one for this address. */
  opa: string | null;
  lng: number;
  lat: number;
}

export type SearchOutcome = { ok: true; results: SearchResult[] } | { ok: false; reason: FailReason | 'empty' };

/** The text to send: control characters removed, spaces collapsed, cut to a sane length. Null when nothing is left. */
export function cleanSearchText(text: string): string | null {
  const cleaned = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_LENGTH).trim();
  return cleaned.length >= 2 ? cleaned : null;
}

export function aisSearchUrl(text: string): string {
  const cleaned = cleanSearchText(text);
  if (!cleaned) throw new Error('Nothing to search for.');
  return `${AIS_SEARCH_URL}${encodeURIComponent(cleaned)}`;
}

function inCity(lng: number, lat: number): boolean {
  const [[west, south], [east, north]] = PHILLY_BOUNDS;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/** The usable results in an AIS answer: addresses and intersections inside the city, without repeats. */
export function parseAisResponse(data: unknown): SearchResult[] {
  if (!data || typeof data !== 'object') return [];
  const features = (data as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const results: SearchResult[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== 'object') continue;
    const f = feature as Record<string, unknown>;
    const geometry = f.geometry as { coordinates?: unknown } | undefined;
    const coords = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
    const [lng, lat] = coords as unknown[];
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat) || !inCity(lng, lat)) continue;
    const properties = (f.properties ?? {}) as Record<string, unknown>;
    let result: SearchResult | null = null;
    if (f.ais_feature_type === 'intersection') {
      const label = typeof f.street_address === 'string' ? f.street_address : null;
      if (label) result = { kind: 'intersection', label, opa: null, lng, lat };
    } else {
      const label = typeof properties.street_address === 'string' ? properties.street_address : null;
      if (label) result = { kind: 'address', label, opa: normalizeAccount(properties.opa_account_num), lng, lat };
    }
    if (result && !results.some((r) => r.label === result.label && r.opa === result.opa)) results.push(result);
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

export async function searchAddress(text: string, options: FetchOptions = {}): Promise<SearchOutcome> {
  const cleaned = cleanSearchText(text);
  if (!cleaned) return { ok: false, reason: 'empty' };
  const result = await fetchJson(aisSearchUrl(cleaned), options);
  if (!result.ok) return { ok: false, reason: result.reason };
  const results = parseAisResponse(result.data);
  return results.length ? { ok: true, results } : { ok: false, reason: 'not_found' };
}
