// City records are shown as the City writes them, with one change: no dashes as punctuation
// (the project's house style covers data the reader sees). "DUMPING - PRIVATE LOT" reads
// "DUMPING, PRIVATE LOT". Hyphens inside words ("SMITH-JONES", "1304-08") stay.

import { sentenceCase } from '../strings.ts';

const SPACED_DASH = /\s+[-–—]+\s+/g;
const LONE_DASH = /[–—]+/g;

export function plain(text: string): string;
export function plain(text: string | null): string | null;
export function plain(text: string | null): string | null {
  if (text === null) return null;
  return text.replace(SPACED_DASH, ', ').replace(LONE_DASH, ', ').replace(/\s+,/g, ',');
}

/** Abbreviations the City writes in its titles, kept in capitals ("ID STRUCTURE" is imminently dangerous). */
const ABBREVIATIONS = new Set(['ID', 'L&I', 'HVAC', 'CLIP', 'CO', 'LO', 'RCO', 'ZBA', 'BBS', 'LIRB']);

/** A City title in sentence case, abbreviations kept, dashes as commas. */
export function cityWords(text: string): string {
  return plain(
    sentenceCase(text)
      .split(' ')
      .map((word) => (ABBREVIATIONS.has(word.toUpperCase()) ? word.toUpperCase() : word))
      .join(' '),
  );
}
