// The neighbor flyer (M5.2, issue #46; the 596 Acres idea): a sign for the fence of a vacant lot
// that says neighbors care about it and how to reach them. Placekeepers has no servers and no
// accounts, so the people who print it bring their own way to be reached. What they type stays in
// this browser (under "placekeepers:v1:flyer") and is printed there; nothing is sent anywhere.

import type { Strings } from '../i18n/english.ts';
import { isLanguageCode, languageOf, type LanguageCode } from '../i18n/languages.ts';
import { withLocale } from '../i18n/locale.ts';
import { readItem, removeItem, writeItem, type KeyValueStore } from '../state/storage.ts';
import { strings } from '../strings.ts';

export const FLYER_KEY = 'flyer';
export const FLYER_VERSION = 1;
export const HOPES = ['cleanup', 'garden', 'seating', 'mural', 'ask_city'] as const;
export type Hope = (typeof HOPES)[number];
export type FlyerSize = 'letter' | 'half';

export interface FlyerFields {
  headline: string;
  hopes: Hope[];
  ownWords: string;
  contact: string;
  ownLink: string;
  ownLinkLabel: string;
  size: FlyerSize;
  /** The language the flyer prints in; none kept means the page's language. */
  language?: LanguageCode;
  /** Print English beside it, in a second column (when the flyer's language is not English). */
  withEnglish?: boolean;
}

export const MAX_FLYER_FIELD = 600;

export function defaultFields(): FlyerFields {
  return { headline: strings.flyer.defaultHeadline, hopes: [], ownWords: '', contact: '', ownLink: '', ownLinkLabel: '', size: 'letter' };
}

function clean(raw: unknown): Partial<FlyerFields> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<FlyerFields> = {};
  for (const key of ['headline', 'ownWords', 'contact', 'ownLink', 'ownLinkLabel'] as const) {
    if (typeof r[key] === 'string') out[key] = (r[key] as string).slice(0, MAX_FLYER_FIELD);
  }
  if (Array.isArray(r.hopes)) out.hopes = r.hopes.filter((h): h is Hope => (HOPES as readonly string[]).includes(h as string));
  if (r.size === 'letter' || r.size === 'half') out.size = r.size;
  if (isLanguageCode(r.language)) out.language = r.language;
  if (typeof r.withEnglish === 'boolean') out.withEnglish = r.withEnglish;
  return out;
}

/** What was typed for flyers, by lot: read forgivingly, nothing unknown kept. */
export function readFlyers(store?: KeyValueStore | null): Record<string, Partial<FlyerFields>> {
  try {
    const text = store === undefined ? readItem(FLYER_KEY) : readItem(FLYER_KEY, store);
    const raw = text ? (JSON.parse(text) as { version?: unknown; lots?: unknown }) : null;
    if (!raw || raw.version !== FLYER_VERSION || !raw.lots || typeof raw.lots !== 'object') return {};
    const out: Record<string, Partial<FlyerFields>> = {};
    for (const [key, value] of Object.entries(raw.lots as Record<string, unknown>).slice(-20)) if (/^\d{9}$|^-$/.test(key)) out[key] = clean(value);
    return out;
  } catch {
    return {};
  }
}

export function writeFlyers(lots: Record<string, Partial<FlyerFields>>, store?: KeyValueStore | null): boolean {
  const entries = Object.entries(lots).slice(-20);
  const text = JSON.stringify({ version: FLYER_VERSION, lots: Object.fromEntries(entries) });
  return store === undefined ? writeItem(FLYER_KEY, text) : writeItem(FLYER_KEY, text, store);
}

export function clearFlyers(store?: KeyValueStore | null): boolean {
  return store === undefined ? removeItem(FLYER_KEY) : removeItem(FLYER_KEY, store);
}

/**
 * What the organizers hope to do, as the flyer lists it: the choices, then their own words (left
 * out with `ownWords: false`, for the second column of a flyer in two languages).
 */
export function hopeLines(fields: Pick<FlyerFields, 'hopes' | 'ownWords'>, t: Strings['flyer'] = strings.flyer, ownWords = true): string[] {
  const lines = HOPES.filter((h) => fields.hopes.includes(h)).map((h) => t.hopeLines[h] ?? h);
  const own = fields.ownWords.trim();
  if (own && ownWords) lines.push(own);
  return lines;
}

/** The words of a flyer in one language: everything on it that the organizers did not type. */
export interface FlyerWords {
  code: LanguageCode;
  dir: 'ltr' | 'rtl';
  headline: string;
  /** The lot's address from the City's records, or its parcel number in words. */
  place: string;
  mapAlt: string;
  hopeTitle: string;
  /** The choices ticked, in this language. */
  hopes: string[];
  /** What the organizers wrote in their own words, as typed: in the first column only. */
  ownWords: string | null;
  reachTitle: string;
  scanLot: string;
  scanLotLabel: string;
  scanOwn: string;
  scanOwnLabel: string;
  byNeighbors: string;
}

/**
 * A flyer's words in one language, from that language's strings (src/i18n/boot.ts, stringsIn),
 * with its numbers and dates. What was typed (a headline, own words, a link's label) is used as
 * typed; own words go in the first column only.
 */
export function flyerWords(
  t: Strings,
  code: LanguageCode,
  fields: FlyerFields,
  lot: { opa: string; address: string | null },
  first = true,
): FlyerWords {
  return withLocale(code, () => {
    const f = t.flyer;
    const ownLabel = fields.ownLinkLabel.trim();
    return {
      code,
      dir: languageOf(code).dir,
      headline: f.defaultHeadline,
      place: lot.address ?? t.place.parcel(lot.opa),
      mapAlt: f.mapAlt(lot.address ?? lot.opa),
      hopeTitle: f.hopeTitle,
      hopes: hopeLines(fields, f, false),
      ownWords: first ? fields.ownWords.trim() || null : null,
      reachTitle: f.reachTitle,
      scanLot: f.scanLot,
      scanLotLabel: f.qrLabel(f.scanLot),
      scanOwn: ownLabel || f.scanOwn,
      scanOwnLabel: f.qrLabel(ownLabel || f.scanOwn),
      byNeighbors: f.byNeighbors,
    };
  });
}

/**
 * The headline as typed, or null when it is a flyer's default headline (in any of the languages
 * given) or empty: the flyer then shows the default in each of its languages.
 */
export function typedHeadline(fields: Pick<FlyerFields, 'headline'>, defaults: readonly string[]): string | null {
  const headline = fields.headline.trim();
  return headline && !defaults.includes(headline) ? headline : null;
}

/**
 * Words in the contact field that look like a home address or a personal phone number, so the
 * page can remind people that what they print is public. Only a reminder: it never blocks.
 */
export function contactCaution(contact: string): boolean {
  const text = contact.trim();
  if (!text) return false;
  const phone = /(\(?\d{3}\)?[\s.]*\d{3}[\s.]*\d{4})/.test(text.replace(/-/g, ' '));
  const street = /\b\d{1,5}\s+(N|S|E|W|NORTH|SOUTH|EAST|WEST)?\.?\s*[A-Z0-9][A-Za-z0-9]*\s+(ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|PL|PLACE|LN|LANE|DR|DRIVE|TER|WAY|CT)\b/i.test(text);
  return phone || street;
}
