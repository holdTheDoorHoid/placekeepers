// Reads a list file back in: a GeoJSON or CSV file downloaded from Placekeepers (src/places/export.ts),
// or any text file of nine digit parcel numbers, such as a column pasted from a spreadsheet. Only
// parcel numbers, addresses and points are taken from it; nothing in the file is ever run or shown
// as anything but plain text.

import { normalizeAccount } from '../dossier/opa.ts';
import { MAX_LIST_PLACES, cleanName, type SavedPlace } from './lists.svelte.ts';

/** Larger files are not lists. */
export const MAX_IMPORT_BYTES = 5_000_000;

export interface ImportedList {
  name: string;
  places: SavedPlace[];
  /** Places past the list limit, left out. */
  leftOut: number;
}

export type ImportResult = { ok: true; list: ImportedList } | { ok: false; reason: 'empty' | 'too_big' };

/** Splits CSV text into rows of cells, following the quoting rules of RFC 4180. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function numberOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function point(lng: unknown, lat: unknown): [number, number] | null {
  const x = numberOrNull(lng);
  const y = numberOrNull(lat);
  if (x === null || y === null || x < -76 || x > -74.5 || y < 39.5 || y > 40.5) return null;
  return [x, y];
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, 200) : null;
}

/** The file name without its folder and extension, as a fallback list name. */
function stem(fileName: string): string {
  return fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '');
}

function fromGeoJson(json: unknown): { name: string | null; places: SavedPlace[] } | null {
  if (!json || typeof json !== 'object' || !Array.isArray((json as { features?: unknown }).features)) return null;
  const places: SavedPlace[] = [];
  for (const feature of (json as { features: unknown[] }).features) {
    if (!feature || typeof feature !== 'object') continue;
    const f = feature as { properties?: Record<string, unknown>; geometry?: { type?: unknown; coordinates?: unknown } };
    const props = f.properties ?? {};
    const id = normalizeAccount(props.opa_account ?? props.id);
    if (!id) continue;
    const coords = f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : [];
    places.push({ id, address: text(props.address), center: point(coords[0], coords[1]), properties: null });
  }
  return { name: text((json as { name?: unknown }).name), places };
}

function fromCsv(body: string): SavedPlace[] {
  const rows = parseCsv(body).filter((r) => !(r.length === 1 && r[0]!.trim() === '') && !r[0]!.startsWith('#'));
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const at = (name: string) => header.indexOf(name);
  const idColumn = at('opa_account');
  if (idColumn < 0) return [];
  return rows.slice(1).flatMap((row) => {
    const id = normalizeAccount(row[idColumn]);
    if (!id) return [];
    return [{ id, address: text(row[at('address')]), center: point(row[at('longitude')], row[at('latitude')]), properties: null }];
  });
}

/** Any nine digit numbers in the text, in order. */
function fromText(body: string): SavedPlace[] {
  return [...body.matchAll(/(?<![\d.])\d{9}(?![\d.])/g)].map((m) => ({ id: m[0], address: null, center: null, properties: null }));
}

export function parseListFile(body: string, fileName: string, fallbackName: string): ImportResult {
  if (body.length > MAX_IMPORT_BYTES) return { ok: false, reason: 'too_big' };
  const clean = body.replace(/^﻿/, '');
  let name: string | null = null;
  let places: SavedPlace[] = [];
  let json: unknown = undefined;
  if (/^\s*[{[]/.test(clean)) {
    try {
      json = JSON.parse(clean);
    } catch {
      json = undefined;
    }
  }
  const geo = json === undefined ? null : fromGeoJson(json);
  if (geo) ({ name, places } = geo);
  else {
    places = fromCsv(clean);
    if (places.length === 0) places = fromText(clean);
  }
  const unique: SavedPlace[] = [];
  for (const place of places) if (!unique.some((p) => p.id === place.id)) unique.push(place);
  if (unique.length === 0) return { ok: false, reason: 'empty' };
  return {
    ok: true,
    list: {
      name: cleanName(name ?? stem(fileName), fallbackName),
      places: unique.slice(0, MAX_LIST_PLACES),
      leftOut: Math.max(0, unique.length - MAX_LIST_PLACES),
    },
  };
}
