// "Did it work?" (M5.4, issue #48): reads tables/didit.json (docs/CONTRACTS.md section 13), the
// results of the yearly study `pk didit`, copied by the weekly publish with this week's count of
// projects neighbors finished. Citywide numbers only: the file names no place, and nothing here
// adds one. Every sentence is written from the verdict codes and numbers with the templates in
// src/strings.ts, so the page reads in every language.

import { strings } from '../strings.ts';

export const DIDIT_TABLE = 'tables/didit.json';
export const SCHEMA = 1;

export const KINDS = ['landcare', 'clean_seal', 'demolition', 'projects'] as const;
export type Kind = (typeof KINDS)[number];
export const OUTCOMES = ['shootings', 'dumping', 'complaints'] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const VERDICTS = ['fewer', 'more', 'no_clear_change', 'check_failed', 'too_few'] as const;
export type Verdict = (typeof VERDICTS)[number];
export type Check = 'passed' | 'failed' | 'too_few';
export type Direction = 'fewer' | 'more' | 'no_clear_change';

/** One comparison's estimate (docs/CONTRACTS.md section 13). */
export interface Estimate {
  places: number;
  areas: number;
  before: number;
  after: number;
  expected: number;
  percent: number | null;
  low: number | null;
  high: number | null;
  per_place_year: number | null;
  per_low: number | null;
  per_high: number | null;
  balance: number | null;
}

export interface Result {
  outcome: Outcome;
  verdict: Verdict;
  check: Check;
  around_verdict: Direction | null;
  /** The first and last half year of care compared, "2017-1" for the first half of 2017. */
  cohorts: [string, string] | null;
  eligible: number;
  dropped: number;
  controls: number;
  main: Estimate;
  around: Estimate;
  later: Estimate;
  placebo: Estimate;
  naive: number | null;
}

export interface KindBlock {
  id: Kind;
  records: number;
  dated: number;
  undated: number;
  read?: boolean;
  results: Result[];
}

export interface OutcomeInfo {
  records: number;
  first: string | null;
  last: string | null;
  first_half: string;
  own_square_left_out: boolean;
}

export interface ProjectsNow {
  as_of: string;
  shown: number;
  ready: number;
  ready_before: string;
}

export interface DiditTable {
  schema: 1;
  generated: string;
  data_through: string;
  method: Record<string, number>;
  rules: { min_places: number; min_areas: number; min_placebo: number };
  outcomes: Record<Outcome, OutcomeInfo>;
  kinds: KindBlock[];
  projects_now?: ProjectsNow | null;
}

function isEstimate(value: unknown): value is Estimate {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.places === 'number' && typeof e.before === 'number' && typeof e.after === 'number';
}

/** The table, or null when it is not one this page can read. */
export function parseTable(raw: unknown): DiditTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (t.schema !== SCHEMA || typeof t.generated !== 'string' || typeof t.data_through !== 'string') return null;
  if (!Array.isArray(t.kinds) || !t.rules || !t.outcomes) return null;
  for (const kind of t.kinds as Record<string, unknown>[]) {
    if (!(KINDS as readonly string[]).includes(kind.id as string) || !Array.isArray(kind.results)) return null;
    for (const r of kind.results as Record<string, unknown>[]) {
      if (!(OUTCOMES as readonly string[]).includes(r.outcome as string)) return null;
      if (!(VERDICTS as readonly string[]).includes(r.verdict as string)) return null;
      if (![r.main, r.around, r.later, r.placebo].every(isEstimate)) return null;
    }
  }
  return raw as DiditTable;
}

export async function loadTable(dataBase: string, fetcher: typeof fetch = fetch): Promise<DiditTable | 'missing' | 'failed'> {
  try {
    const response = await fetcher(`${dataBase}${DIDIT_TABLE}`);
    if (response.status === 404) return 'missing';
    if (!response.ok) return 'failed';
    return parseTable(await response.json()) ?? 'failed';
  } catch {
    return 'failed';
  }
}

const t = () => strings.didit;

/** "the first half of 2017" from "2017-1". */
export function halfWords(label: string): string {
  const [year, half] = label.split('-');
  return t().half(Number(year), half === '1' ? 1 : 2);
}

/** "3.2% more", "6.2% fewer" or "no change": a percent change in words. */
export function changeWords(percent: number): string {
  if (percent === 0) return t().noChange;
  return percent < 0 ? t().fewerBy(-percent) : t().moreBy(percent);
}

/** "6.2% fewer to 0.2% more": a 90 percent interval in words. */
export function rangeWords(e: Estimate): string {
  return e.low === null || e.high === null ? '' : t().range(changeWords(e.low), changeWords(e.high));
}

/** The plain sentence of one comparison's verdict. */
export function verdictSentence(kind: Kind, r: Result, rules: DiditTable['rules']): string[] {
  const noun = t().outcomeNouns[r.outcome]!;
  const m = r.main;
  switch (r.verdict) {
    case 'too_few':
      return [t().verdicts.tooFew(m.places, rules.min_places)];
    case 'check_failed':
      return [t().verdicts.checkFailed(noun)];
    case 'no_clear_change':
      return [t().verdicts.noClearChange(changeWords(m.percent ?? 0), rangeWords(m))];
    case 'fewer':
      return [t().verdicts.fewer(noun, Math.abs(m.percent ?? 0), rangeWords(m))];
    case 'more': {
      const out = [t().verdicts.more(noun, m.percent ?? 0, rangeWords(m)), t().verdicts.notCaused, t().whyMore[kind]!];
      if (r.outcome !== 'shootings') out.push(t().verdicts.moreReports);
      return out;
    }
  }
}

/** The numbers behind a comparison: what was compared, and the counts before and after. */
export function numberLines(r: Result): string[] {
  const m = r.main;
  if (m.places === 0 || !r.cohorts) return [];
  return [
    t().compared(m.places, halfWords(r.cohorts[0]), halfWords(r.cohorts[1]), m.areas),
    t().counts(m.before, m.after, Math.round(m.expected)),
  ];
}

/** The checks of a comparison: the placebo, the ring around, the later care, the simple before
 * and after. */
export function checkLines(r: Result): string[] {
  const noun = t().outcomeNouns[r.outcome]!;
  const lines: string[] = [];
  if (r.check === 'too_few') lines.push(t().checks.tooFew);
  else if (r.placebo.percent !== null) {
    const words = [changeWords(r.placebo.percent), rangeWords(r.placebo), r.placebo.places] as const;
    lines.push(r.check === 'passed' ? t().checks.passed(...words) : t().checks.failed(...words));
  }
  if (r.around.percent !== null && r.around.places > 0) {
    lines.push(t().checks.around(changeWords(r.around.percent), rangeWords(r.around)));
    if (r.verdict === 'fewer' && r.around_verdict === 'more') lines.push(t().checks.moved);
  }
  if (r.later.percent !== null && r.later.places > 0) {
    lines.push(t().checks.later(changeWords(r.later.percent), rangeWords(r.later), r.later.places));
  }
  if (r.naive !== null && r.main.places > 0) lines.push(t().checks.naive(changeWords(r.naive), noun));
  return lines;
}

/** Everything under a comparison's verdict, in order. */
export function detailLines(r: Result): string[] {
  return [...numberLines(r), ...checkLines(r)];
}

/** How many comparisons ended each way, for the short answer (projects with no places left out). */
export function tally(table: DiditTable): Record<Verdict, number> & { total: number } {
  const out = { fewer: 0, more: 0, no_clear_change: 0, check_failed: 0, too_few: 0, total: 0 };
  for (const kind of table.kinds) {
    for (const r of kind.results) {
      if (r.main.places === 0) continue;
      out[r.verdict] += 1;
      out.total += 1;
    }
  }
  return out;
}
