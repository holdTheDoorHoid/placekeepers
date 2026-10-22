// The neighbor flyer (M5.2, issue #46; the 596 Acres idea): a sign for the fence of a vacant lot
// that says neighbors care about it and how to reach them. Placekeepers has no servers and no
// accounts, so the people who print it bring their own way to be reached. What they type stays in
// this browser (under "placekeepers:v1:flyer") and is printed there; nothing is sent anywhere.

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

/** What the organizers hope to do, as the flyer lists it: the choices, then their own words. */
export function hopeLines(fields: Pick<FlyerFields, 'hopes' | 'ownWords'>): string[] {
  const lines = HOPES.filter((h) => fields.hopes.includes(h)).map((h) => strings.flyer.hopeLines[h] ?? h);
  const own = fields.ownWords.trim();
  if (own) lines.push(own);
  return lines;
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
