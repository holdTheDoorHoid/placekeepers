// What the deed history says, with the pipeline's rules (pipeline/src/placekeepers/derive/
// transfers.py, milestone M1.3), so the flags agree whether the history is live or from the
// weekly snapshot:
//
// * a sheriff sale is a deed of type "DEED SHERIFF" or "SHERIFF'S DEED";
// * a sale is a deed for more than a token price ($100), other than a sheriff, condemnation or
//   adverse possession deed (those stay in the full history);
// * fast resales are two or more deeds for a price within 24 months of each other;
// * the City's deed records are complete only from 2000 on, so the assessor's own last sale fills
//   in older years.

import { addMonths, daysBetween, yearOf } from './dates.ts';
import type { Transfer } from './types.ts';

export const SHERIFF_TYPES = new Set(['DEED SHERIFF', "SHERIFF'S DEED"]);
export const NOT_SALES = new Set(['DEED OF CONDEMNATION', 'DEED - ADVERSE POSSESSION']);
export const NOMINAL_MAX = 100;
export const FULL_RECORDS_FROM = '2000-01-01';
export const RESALE_MONTHS = 24;

const normalType = (type: string) => type.toUpperCase().replace(/\s+/g, ' ').trim();

export function isSheriff(t: Transfer): boolean {
  return SHERIFF_TYPES.has(normalType(t.type));
}

export function isPriced(t: Transfer): boolean {
  return t.price !== null && t.price > NOMINAL_MAX;
}

/** A sale in the "last sold" sense. */
export function isSale(t: Transfer): boolean {
  return isPriced(t) && !isSheriff(t) && !NOT_SALES.has(normalType(t.type));
}

type Dated = Transfer & { date: string };
const dated = (history: Transfer[], asOf: string): Dated[] => history.filter((t): t is Dated => t.date !== null && t.date <= asOf);

/** Sheriff sales, oldest first. */
export function sheriffSales(history: Transfer[], asOf: string): Dated[] {
  return dated(history, asOf)
    .filter(isSheriff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface LastSale {
  /** The year of the last sale, or the year since which there has been none. */
  year: number;
  /** True when `year` is the last sale; false when it means "not sold since at least". */
  known: boolean;
}

/**
 * The last sale for a price, from the deed records or the assessor's last sale. The assessor's
 * sale counts when its price is above a token price and no deed falls within 60 days of it.
 */
export function lastSale(history: Transfer[], opaSaleDate: string | null, opaSalePrice: number | null, asOf: string): LastSale {
  const found = dated(history, asOf)
    .filter(isSale)
    .map((t) => t.date);
  const opaOk = opaSaleDate !== null && opaSaleDate >= '1800-01-01' && opaSaleDate <= asOf;
  if (
    opaOk &&
    opaSalePrice !== null &&
    opaSalePrice > NOMINAL_MAX &&
    !history.some((t) => t.date !== null && Math.abs(daysBetween(t.date, opaSaleDate)) <= 60)
  ) {
    found.push(opaSaleDate);
  }
  if (found.length) return { year: yearOf(found.sort().at(-1)!), known: true };
  if (opaOk && opaSaleDate < FULL_RECORDS_FROM) return { year: yearOf(opaSaleDate), known: false };
  return { year: yearOf(FULL_RECORDS_FROM), known: false };
}

export interface Resales {
  count: number;
  first: string;
  last: string;
  /** The latest of them is within 24 months of today. */
  recent: boolean;
}

/** The latest run of two or more deeds for a price, each within 24 months of the one before. Deeds on one day count once. */
export function fastResales(history: Transfer[], asOf: string): Resales | null {
  const days = [
    ...new Set(
      dated(history, asOf)
        .filter((t) => isPriced(t) && !NOT_SALES.has(normalType(t.type)))
        .map((t) => t.date),
    ),
  ].sort();
  if (days.length < 2) return null;
  const runs: string[][] = [[days[0]!]];
  for (const day of days.slice(1)) {
    const run = runs[runs.length - 1]!;
    if (day <= addMonths(run[run.length - 1]!, RESALE_MONTHS)) run.push(day);
    else runs.push([day]);
  }
  const latest = [...runs].reverse().find((run) => run.length >= 2);
  if (!latest) return null;
  const last = latest[latest.length - 1]!;
  return { count: latest.length, first: latest[0]!, last, recent: last >= addMonths(asOf, -RESALE_MONTHS) };
}
