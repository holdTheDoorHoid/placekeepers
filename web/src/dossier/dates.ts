// Dates in the dossier are calendar days in Philadelphia, written YYYY-MM-DD. City servers send
// timestamps in UTC ("2025-11-25T01:15:43Z" is the evening of November 24 in Philadelphia), so
// each one is turned into the day it was in Philadelphia before it is shown or compared.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const cityDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** True for a real calendar day written YYYY-MM-DD. */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DAY.exec(value);
  if (!match) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The Philadelphia calendar day of a City value: a YYYY-MM-DD day, or a timestamp. Null when unreadable. */
export function cityDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const text = value.trim();
  if (isDay(text)) return text;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return null;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  // en-CA writes dates as YYYY-MM-DD.
  return cityDay.format(d);
}

/** Today in Philadelphia. */
export function today(now: Date = new Date()): string {
  return cityDay.format(now);
}

export function yearOf(day: string): number {
  return Number(day.slice(0, 4));
}

/** The same calendar day `months` later (or earlier), clamped to the end of shorter months. */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Whole days from one day to another. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}
