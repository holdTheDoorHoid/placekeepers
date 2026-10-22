// What someone types into the letters (M5.1): kept in this browser only, under
// "placekeepers:v1:letters", like saved lists (docs/ETHICS.md, "Privacy"), so they can come back to
// a letter; never in the address bar, never sent anywhere. One button clears all of it.
//
// Storage can be missing, full or blocked; every access goes through src/state/storage.ts, which
// never throws, and `persistent` says whether the last change was kept.

import { readItem, removeItem, writeItem, type KeyValueStore } from '../state/storage.ts';
import { EMPTY_FIELDS, MAX_FIELD, type LetterFields, type TemplateId } from './templates.ts';

export const LETTERS_KEY = 'letters';
export const LETTERS_VERSION = 1;
/** Drafts kept at most; the oldest go first. */
export const MAX_DRAFTS = 40;

/** What the sender types once and every letter reuses. */
export const SENDER_FIELDS = ['senderName', 'group', 'contact'] as const;
type SenderField = (typeof SENDER_FIELDS)[number];

export type Draft = Partial<LetterFields>;

export interface LetterStore {
  sender: Partial<Pick<LetterFields, SenderField>>;
  drafts: Record<string, Draft>;
}

/** The draft of one letter: its template and the lot (or nothing) it is about. */
export function draftKey(template: TemplateId, opa: string | null): string {
  return `${template}:${opa ?? '-'}`;
}

function cleanText(v: unknown): string | undefined {
  return typeof v === 'string' ? v.slice(0, MAX_FIELD) : undefined;
}

function cleanDraft(raw: unknown): Draft {
  if (!raw || typeof raw !== 'object') return {};
  const out: Draft = {};
  for (const key of Object.keys(EMPTY_FIELDS) as (keyof LetterFields)[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (key === 'plans') {
      if (Array.isArray(value)) out.plans = value.filter((x): x is string => typeof x === 'string').slice(0, 10);
    } else {
      const text = cleanText(value);
      if (text !== undefined) (out as Record<string, string>)[key] = text;
    }
  }
  return out;
}

export function parseLetters(text: string | null): LetterStore {
  try {
    const raw = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    if (!raw || raw.version !== LETTERS_VERSION) return { sender: {}, drafts: {} };
    const sender = cleanDraft(raw.sender);
    const drafts: Record<string, Draft> = {};
    const entries = raw.drafts && typeof raw.drafts === 'object' ? Object.entries(raw.drafts as Record<string, unknown>) : [];
    for (const [key, value] of entries.slice(-MAX_DRAFTS)) if (/^[a-z]+:(\d{9}|-)$/.test(key)) drafts[key] = cleanDraft(value);
    const kept = Object.fromEntries(SENDER_FIELDS.filter((field) => sender[field] !== undefined).map((field) => [field, sender[field]]));
    return { sender: kept, drafts };
  } catch {
    return { sender: {}, drafts: {} };
  }
}

export class LetterDrafts {
  data: LetterStore;
  persistent = true;
  private readonly store: KeyValueStore | null | undefined;

  constructor(store?: KeyValueStore | null) {
    this.store = store;
    this.data = parseLetters(store === undefined ? readItem(LETTERS_KEY) : readItem(LETTERS_KEY, store));
  }

  private save(): void {
    const keys = Object.keys(this.data.drafts);
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DRAFTS))) delete this.data.drafts[key];
    const text = JSON.stringify({ version: LETTERS_VERSION, ...this.data });
    this.persistent = this.store === undefined ? writeItem(LETTERS_KEY, text) : writeItem(LETTERS_KEY, text, this.store);
  }

  /** What was typed for one letter, with the sender's details shared by every letter. */
  get(key: string): Draft {
    return { ...this.data.drafts[key], ...this.data.sender };
  }

  /** Keeps one field of one letter; the sender's name, group and contact are kept for every letter. */
  set(key: string, field: keyof LetterFields, value: string | string[]): void {
    if ((SENDER_FIELDS as readonly string[]).includes(field)) {
      this.data.sender = { ...this.data.sender, [field]: String(value).slice(0, MAX_FIELD) };
    } else {
      const draft = { ...this.data.drafts[key] };
      if (Array.isArray(value)) draft.plans = value.slice(0, 10);
      else (draft as Record<string, string>)[field] = value.slice(0, MAX_FIELD);
      // Move the draft to the end, so the oldest is the one dropped.
      delete this.data.drafts[key];
      this.data.drafts[key] = draft;
    }
    this.save();
  }

  /** Forgets everything typed into any letter, in this browser. */
  clear(): void {
    this.data = { sender: {}, drafts: {} };
    this.persistent = this.store === undefined ? removeItem(LETTERS_KEY) : removeItem(LETTERS_KEY, this.store);
  }
}
