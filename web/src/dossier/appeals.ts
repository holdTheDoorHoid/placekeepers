// Appeals and hearings (M4.6, issue #42): every appeal the City's `appeals` table holds for a
// parcel, to the Zoning Board of Adjustment, the L&I Review Board, the Board of Building Standards
// and a few other boards.
//
// The weekly copy (the dossier's `appeals`, docs/CONTRACTS.md section 6) and a live lookup read an
// appeal the same way: the pipeline reads the columns of APPEAL_COLUMNS and turns them into records
// with placekeepers.derive.appeals, and readAppeals does exactly the same with the City's live
// answer. Both test suites check pipeline/tests/fixtures/timeline_parity.json.
//
// Who filed an appeal and the owner the City names are shown on the lot's own page and nowhere
// else (docs/ETHICS.md, "Appeals and hearings"). The appeal's number is read only to list each
// appeal once (for a zoning appeal it is the zoning permit's number, which the site never shows),
// and its free text grounds are never read: the page links to the City for them.

import { APPEAL_BOARDS, type Appeal, type AppealBoard } from './types.ts';

/** The City's columns both sides read (pipeline/src/placekeepers/adapters/rules.py, APPEAL_COLUMNS). */
export const APPEAL_COLUMNS = [
  'appealnumber',
  'applicationtype',
  'appealtype',
  'appealstatus',
  'decision',
  'createddate',
  'scheduleddate',
  'decisiondate',
  'coordinatingrco',
  'primaryappellant',
  'opa_owner',
] as const;

/** The boards, by the City's application type (pipeline/src/placekeepers/derive/appeals.py, BOARDS). */
const BOARDS: Record<string, AppealBoard> = {
  RB_ZBA: 'zoning',
  'ZONING BOARD OF ADJUSTMENT': 'zoning',
  RB_LIRB: 'li_review',
  'L&I REVIEW BOARD CODES': 'li_review',
  'L&I REVIEW BOARD OTHER': 'li_review',
  RB_BBS: 'building',
  'BOARD OF BUILDING STANDARDS': 'building',
  'BBS ID/U TIME EXTENSION REQUEST': 'building',
};

/** Statuses that mean an appeal is over, and decisions after which a hearing is still to come. */
const CLOSED_STATUSES = new Set(['CLOSED', 'COMPLETED', 'DISMISSED / WITHDRAWN', 'CANCELLED', 'WITHDRAWN', 'DISMISSED']);
const STILL_TO_COME = new Set(['CONTINUED', 'HELD', 'HELD/INFO']);

/** Text as the pipeline keeps it: white space runs as one space, trimmed; null when empty. */
function clean(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const t = String(value).replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

export function boardOf(application: string | null): AppealBoard {
  return BOARDS[(application ?? '').toUpperCase().trim()] ?? 'other';
}

const STAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/;

const cityClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * A time the City writes (2027-02-24T20:30:00Z, or 2027-02-24 20:30:00+00, or a bare day) as its
 * day and time of day in Philadelphia: ["2027-02-24", "15:30"]. A bare day has no time, and nor
 * does midnight in Philadelphia, the City's way of writing a day alone.
 */
export function localMoment(value: unknown): [string | null, string | null] {
  if (typeof value !== 'string') return [null, null];
  const found = STAMP.exec(value.trim());
  if (!found) return [null, null];
  const [, year, month, day, hour, minute, second, zone] = found;
  if (hour === undefined) return [`${year}-${month}-${day}`, null];
  let ms = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0));
  // A day or time out of range (2026-02-30) is no time at all, as in the pipeline.
  const check = new Date(ms);
  if (check.getUTCDate() !== Number(day) || check.getUTCHours() !== Number(hour) || check.getUTCMonth() !== Number(month) - 1) return [null, null];
  if (zone && zone !== 'Z') {
    const sign = zone[0] === '+' ? 1 : -1;
    const digits = zone.slice(1).replace(':', '');
    const offset = sign * (Number(digits.slice(0, 2)) * 3600 + Number(digits.slice(2, 4) || 0) * 60);
    ms -= offset * 1000;
  }
  const parts = Object.fromEntries(cityClock.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const clock = `${parts.hour}:${parts.minute}`;
  return [`${parts.year}-${parts.month}-${parts.day}`, clock === '00:00' ? null : clock];
}

type Row = Record<string, unknown>;

/** One appeal as a lot page shows it, or null for a row without an appeal number. */
export function appealRecord(row: Row): Appeal | null {
  if (clean(row.appealnumber) === null) return null;
  const application = clean(row.applicationtype);
  const [filed] = localMoment(row.createddate);
  const [hearing, hearingTime] = localMoment(row.scheduleddate);
  const [decided] = localMoment(row.decisiondate);
  return {
    board: boardOf(application),
    application,
    type: clean(row.appealtype),
    status: clean(row.appealstatus),
    decision: clean(row.decision),
    filed,
    hearing,
    hearingTime: hearing ? hearingTime : null,
    decided,
    rco: clean(row.coordinatingrco),
    appellant: clean(row.primaryappellant),
    owner: clean(row.opa_owner),
  };
}

/** Code point order, as the pipeline sorts. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A parcel's appeals from the City's answer: each appeal number once (the first row read), newest
 * filing first, then the later hearing first, then by appeal number (which is not kept).
 */
export function readAppeals(rows: Row[]): Appeal[] {
  const seen = new Map<string, Appeal>();
  for (const row of rows) {
    const number = clean(row.appealnumber);
    const record = appealRecord(row);
    if (number !== null && record && !seen.has(number)) seen.set(number, record);
  }
  return [...seen.entries()]
    .sort(([na, a], [nb, b]) => cmp(b.filed ?? '', a.filed ?? '') || cmp(b.hearing ?? '', a.hearing ?? '') || cmp(na, nb))
    .map(([, record]) => record);
}

/** A hearing still to come: today or later, the appeal not closed, and no decision has ended it (a continued hearing is still to come). */
export function isUpcoming(appeal: Pick<Appeal, 'hearing' | 'status' | 'decision'>, today: string): boolean {
  if (!appeal.hearing || appeal.hearing < today) return false;
  if (CLOSED_STATUSES.has((appeal.status ?? '').toUpperCase())) return false;
  const decision = (appeal.decision ?? '').toUpperCase();
  return decision === '' || STILL_TO_COME.has(decision);
}

/** The next hearing still to come, or null. */
export function nextHearing(appeals: Appeal[], today: string): Appeal | null {
  const coming = appeals.filter((a) => isUpcoming(a, today));
  coming.sort((a, b) => cmp(a.hearing!, b.hearing!) || cmp(a.hearingTime ?? '', b.hearingTime ?? ''));
  return coming[0] ?? null;
}

/** An appeal as the pipeline writes it in a dossier shard: snake case keys, empty values left out. */
export function encodeAppeal(a: Appeal): Record<string, string> {
  const out: Record<string, string | null> = {
    board: a.board,
    application: a.application,
    type: a.type,
    status: a.status,
    decision: a.decision,
    filed: a.filed,
    hearing: a.hearing,
    hearing_time: a.hearingTime,
    decided: a.decided,
    rco: a.rco,
    appellant: a.appellant,
    owner: a.owner,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== null)) as Record<string, string>;
}

export { APPEAL_BOARDS };
