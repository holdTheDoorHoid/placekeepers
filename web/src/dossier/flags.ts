// The owner flags of docs/ETHICS.md, worked out from live City records with the pipeline's rules
// and wording (pipeline/src/placekeepers/derive/flags.py and wording.py), and the parts a flag
// from the weekly snapshot may leave out. Every flag has three parts: what it means, why to be
// careful, and a protective next step. Where ETHICS.md gives wording, it is used word for word
// (tests/dossier_flags.test.ts checks it against ETHICS.md itself). Every sentence must equal the
// pipeline's: tests/dossier_parity.test.ts checks this file and owners.ts against cases the
// pipeline answered (pipeline/tests/fixtures/wording_parity.json).
//
// Which owners get which flags (the same split as the pipeline):
// * every owner: past sheriff sales, fast resales, open violations, unsafe, imminently dangerous,
//   and tax debt as of July 2025 (from the snapshot only);
// * private owners only: absentee, possible estate, years since the last sale, many vacant
//   parcels (from the snapshot only).
//
// The flags about the owner rather than the parcel (absentee, possible estate, tax debt, many
// vacant parcels) are held back, as the pipeline holds them back, for an owner who may be a person
// unless we call the parcel vacant with high or medium confidence; possible estate never shows
// with a homestead exemption (docs/ETHICS.md; ownerFlagAllowed).

import {
  DEED_FRAUD_CHECK_URL,
  FRAUD_GUARD_URL,
  GJLI_URL,
  SHERIFF_SALE_GUIDE_URL,
  TANGLED_TITLE_FUND_URL,
  TAX_CENTER_URL,
} from '../config/links.ts';
import { markFallback } from '../i18n/marks.ts';
import { formatDate, formatMoney, strings } from '../strings.ts';
import { addMonths, yearOf } from './dates.ts';
import { absentee, isPrivate, placeName, possibleEstate, type Absentee } from './owners.ts';
import { plain } from './plain.ts';
import { RESALE_MONTHS, fastResales, lastSale, sheriffSales, type Resales } from './transfers.ts';
import type { FlagNote, LiEvent, Link, OwnerFlag, OwnerType, Transfer } from './types.ts';

/** Every flag id, in the order a lot page lists them. */
export const FLAG_IDS = [
  'absentee',
  'possible_estate',
  'tax_debt_2025',
  'sheriff_sales',
  'years_since_sale',
  'many_parcels',
  'fast_resales',
  'open_violations',
  'unsafe',
  'imminently_dangerous',
] as const;
export type FlagId = (typeof FLAG_IDS)[number];

/** The flags about the owner rather than the parcel: held back on a parcel that may be someone's home. */
export const ABOUT_THE_OWNER: readonly string[] = ['absentee', 'possible_estate', 'tax_debt_2025', 'many_parcels'];

/** What decides whether the flags about the owner may show on a lot page. */
export interface OwnerFlagRule {
  /** The owner may be a person (personLike). */
  personLike: boolean;
  /** We call the parcel vacant with high or medium confidence. */
  calledVacant: boolean;
  /** The City records a homestead exemption: someone lives there, or did. */
  homestead: boolean;
}

/** The owner may be a person: typed as one, of a type we could not tell, or a private owner whose names carry an estate. */
export function personLike(type: OwnerType, names: string[]): boolean {
  return type === 'individual' || type === 'unknown' || (isPrivate(type, names.length > 0) && possibleEstate(names));
}

/**
 * Whether a flag may be shown (the pipeline's owner_flag_allowed, docs/VERIFICATION.md D5 and D6):
 * the flags about an owner who may be a person only on a parcel we call vacant with high or medium
 * confidence, and possible estate never with a homestead exemption.
 */
export function ownerFlagAllowed(id: string, rule: OwnerFlagRule): boolean {
  if (id === 'possible_estate' && rule.homestead) return false;
  return !(ABOUT_THE_OWNER.includes(id) && rule.personLike && !rule.calledVacant);
}

/**
 * The deed fraud notice appears whenever the owner may be a person, flags or not (the pipeline's
 * shows_deed_fraud_notice): it protects the family living there and says nothing about the owner.
 */
export function showsDeedFraudNotice(type: OwnerType, names: string[]): boolean {
  return personLike(type, names);
}

/** Which live lookup each flag is worked out from; the rest come only from the weekly snapshot. */
export const FLAG_PART: Record<FlagId, 'owner' | 'transfers' | 'li' | 'snapshot'> = {
  absentee: 'owner',
  possible_estate: 'owner',
  tax_debt_2025: 'snapshot',
  sheriff_sales: 'transfers',
  years_since_sale: 'transfers',
  many_parcels: 'snapshot',
  fast_resales: 'transfers',
  open_violations: 'li',
  unsafe: 'li',
  imminently_dangerous: 'li',
};

const f = strings.dossier.flags;
const o = strings.dossier.owner;

const link = (label: string, url: string): Link => ({ label, url });

/** The links each kind of flag always carries, whatever the shard says. */
export function flagLinks(id: string): Link[] {
  switch (id) {
    case 'possible_estate':
      return [link(o.tangledTitle, TANGLED_TITLE_FUND_URL), link(o.fraudGuard, FRAUD_GUARD_URL)];
    case 'tax_debt_2025':
      return [link(o.taxCenter, TAX_CENTER_URL), link(o.sheriffGuide, SHERIFF_SALE_GUIDE_URL)];
    case 'sheriff_sales':
      return [link(o.sheriffGuide, SHERIFF_SALE_GUIDE_URL), link(o.gjli, GJLI_URL)];
    case 'years_since_sale':
      return [link(o.tangledTitle, TANGLED_TITLE_FUND_URL)];
    case 'fast_resales':
      return [link(o.fraudGuard, FRAUD_GUARD_URL)];
    case 'absentee':
    case 'many_parcels':
      return [link(o.gjli, GJLI_URL)];
    default:
      return [];
  }
}

/** The page's own "be careful" and "next step" wording for a flag id, or null for an id it does not know. */
export function flagParts(id: string): { careful: string; nextStep: string } | null {
  const parts = (f as Record<string, { careful?: string; next?: string }>)[id];
  return parts?.careful && parts.next ? { careful: parts.careful, nextStep: parts.next } : null;
}

function make(id: FlagId, text: string): OwnerFlag {
  const parts = flagParts(id)!;
  return { id, text, careful: parts.careful, nextStep: parts.nextStep, links: flagLinks(id) };
}

/** Links without repeats, first ones first. */
export function mergeLinks(...lists: Link[][]): Link[] {
  const out: Link[] = [];
  for (const list of lists) for (const l of list) if (!out.some((x) => x.url === l.url)) out.push(l);
  return out;
}

/**
 * A flag made whole: its own text; the careful note and next step shared by every shard
 * (dossiers/common.json) when there is one, else the flag's own, else the page's wording; and
 * its links, the links of its routes, and the links its kind always carries. The possible estate
 * flag always reads exactly as docs/ETHICS.md.
 */
export function completeFlag(
  flag: OwnerFlag,
  note: FlagNote | null = null,
  routeLinks: Link[] = [],
  options: { ownWords?: boolean } = {},
): OwnerFlag {
  const parts = flagParts(flag.id);
  const estate = flag.id === 'possible_estate';
  if (options.ownWords) {
    // A page in another language (issue #49): the page's own careful note, next step and link
    // names, which the catalogs translate. The weekly copy's English is kept, marked as English,
    // only where the page has no words of its own.
    const english = (text: string | null | undefined) => (text ? markFallback(text) : null);
    const englishLinks = (links: Link[]) => links.map((l) => ({ ...l, label: markFallback(l.label) }));
    return {
      id: flag.id,
      text: estate ? f.possible_estate.text : flag.text,
      careful: estate ? f.possible_estate.careful : (parts?.careful ?? english(note?.careful ?? flag.careful)),
      nextStep: estate ? f.possible_estate.next : (parts?.nextStep ?? english(note?.nextStep ?? flag.nextStep)),
      links: mergeLinks(flagLinks(flag.id), routeLinks, englishLinks(flag.links), englishLinks(note?.links ?? [])),
      list: flag.list ?? null,
      parcels: flag.parcels ?? null,
    };
  }
  return {
    id: flag.id,
    text: estate ? f.possible_estate.text : flag.text,
    careful: estate ? f.possible_estate.careful : (note?.careful ?? flag.careful ?? parts?.careful ?? null),
    nextStep: estate ? f.possible_estate.next : (note?.nextStep ?? flag.nextStep ?? parts?.nextStep ?? null),
    links: mergeLinks(flag.links, note?.links ?? [], routeLinks, flagLinks(flag.id)),
    list: flag.list ?? null,
    parcels: flag.parcels ?? null,
  };
}

export function absenteeText(found: Absentee): string {
  const a = f.absentee;
  const city = found.city ? plain(found.city) : found.city;
  found = { ...found, city };
  if (found.scope === 'out_of_state') {
    const where = [found.city ? placeName(found.city) : null, found.state].filter(Boolean).join(', ');
    return where ? a.outOfState(where) : a.outsidePennsylvania;
  }
  if (found.scope === 'outside_city') return found.city ? a.outsideCity(placeName(found.city)) : a.outsideCityUnknown;
  if (found.scope === 'po_box_in_city') return a.poBox;
  return a.elsewhere;
}

export function sheriffText(sales: { date: string; price: number | null }[]): string {
  const one = (s: { date: string; price: number | null }) =>
    f.sheriff_sales.sale(formatDate(s.date) ?? s.date, s.price ? formatMoney(s.price) : null);
  if (sales.length === 1) return f.sheriff_sales.one(one(sales[0]!));
  const items = sales.map(one);
  return f.sheriff_sales.many(sales.length, f.sheriff_sales.andLast(items.slice(0, -1).join('; '), items[items.length - 1]!));
}

export function resaleText(r: Resales): string {
  const first = yearOf(r.first);
  const last = yearOf(r.last);
  if (r.recent) return f.fast_resales.since(r.count, first);
  if (first === last) return f.fast_resales.inYear(r.count, first);
  return f.fast_resales.between(r.count, first, last);
}

export interface LiFacts {
  openViolations: number;
  lastOpen: string | null;
  lastOpenTitle: string | null;
  unsafeSince: string | null;
  dangerousSince: string | null;
}

/** What the L&I timeline says for the flags: open violations, and open unsafe or imminently dangerous notices. */
export function liFacts(events: LiEvent[]): LiFacts {
  const open = events.filter((e) => e.kind === 'violation' && e.open);
  // The violation the flag quotes, as the pipeline picks it (publish/dossiers.py, LAST_OPEN_TITLE):
  // the newest, and on a day with several, the title first in code point order; no title last.
  const title = (e: LiEvent) => e.title?.replace(/\s+/g, ' ').trim() || null;
  // Code point order with nulls last; `newest` puts the later day first, undated last.
  const order = (x: string | null, y: string | null) => (x === y ? 0 : x === null ? 1 : y === null ? -1 : x < y ? -1 : 1);
  const newest = (x: string | null, y: string | null) => (x === y ? 0 : x === null ? 1 : y === null ? -1 : x > y ? -1 : 1);
  const latest = [...open].sort((a, b) => newest(a.date, b.date) || order(title(a), title(b)))[0];
  const since = (kind: LiEvent['kind']) =>
    events
      .filter((e) => e.kind === kind && e.open && e.date)
      .map((e) => e.date!)
      .sort()[0] ?? (events.some((e) => e.kind === kind && e.open) ? '' : null);
  const unsafe = since('unsafe');
  const dangerous = since('imminently_dangerous');
  return {
    openViolations: open.length,
    lastOpen: latest?.date ?? null,
    lastOpenTitle: latest ? title(latest) : null,
    unsafeSince: unsafe,
    dangerousSince: dangerous,
  };
}

export function violationsText(li: LiFacts): string {
  const when = li.lastOpen ? formatDate(li.lastOpen) : null;
  const what = li.lastOpenTitle ? plain(li.lastOpenTitle).toLowerCase() : null;
  if (li.openViolations === 1) return f.open_violations.one(when, what);
  const text = f.open_violations.many(li.openViolations);
  return when ? `${text} ${f.open_violations.mostRecent(when, what)}` : text;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const dataNumber = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const dataText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * A weekly copy flag's sentence written again from its data (docs/CONTRACTS.md section 6) with
 * the page's own templates, so it reads in the page's language. The pipeline writes the same
 * sentence in English beside the data; this returns null where the data cannot say it, and the
 * caller keeps the English. `asOf` is the day the weekly copy was built (for fast resales).
 */
export function flagTextFromData(id: string, data: Record<string, unknown>, asOf: string | null): string | null {
  const day = (v: unknown) => {
    const d = dataText(v);
    return d ? (formatDate(d) ?? d) : null;
  };
  switch (id) {
    case 'absentee': {
      const scope = dataText(data.scope);
      const place = dataText(data.place);
      if (scope === 'out_of_state') return place ? f.absentee.outOfState(place) : f.absentee.outsidePennsylvania;
      if (scope === 'outside_city') {
        const city = place?.replace(/,\s*PA$/i, '') || null;
        return city ? f.absentee.outsideCity(city) : f.absentee.outsideCityUnknown;
      }
      if (scope === 'po_box_in_city') return f.absentee.poBox;
      if (scope === 'elsewhere_in_city') return f.absentee.elsewhere;
      return null;
    }
    case 'possible_estate':
      return f.possible_estate.text;
    case 'tax_debt_2025': {
      const total = dataNumber(data.total_due);
      return total === null ? null : f.tax_debt_2025.text(formatMoney(total), dataNumber(data.years));
    }
    case 'sheriff_sales': {
      const sales = (Array.isArray(data.sales) ? data.sales : [])
        .filter(isRecord)
        .map((s) => ({ date: dataText(s.date), price: dataNumber(s.price) }))
        .filter((s): s is { date: string; price: number | null } => s.date !== null);
      return sales.length ? sheriffText(sales) : null;
    }
    case 'years_since_sale': {
      const year = dataNumber(data.year);
      if (year === null) return null;
      return data.sold === false ? f.years_since_sale.notSoldSince(year) : f.years_since_sale.lastSold(year);
    }
    case 'many_parcels': {
      const n = dataNumber(data.count);
      return n === null ? null : f.many_parcels.text(n);
    }
    case 'fast_resales': {
      const dates = (Array.isArray(data.dates) ? data.dates : []).map(dataText).filter((d): d is string => d !== null).sort();
      if (dates.length < 2 || !asOf) return null;
      const last = dates[dates.length - 1]!;
      const resales: Resales = { count: dataNumber(data.count) ?? dates.length, first: dates[0]!, last, recent: last >= addMonths(asOf, -RESALE_MONTHS) };
      return resaleText(resales);
    }
    case 'open_violations': {
      const n = dataNumber(data.count);
      if (!n) return null;
      return violationsText({ openViolations: n, lastOpen: dataText(data.last), lastOpenTitle: dataText(data.title), unsafeSince: null, dangerousSince: null });
    }
    case 'unsafe':
      return f.unsafe.text(day(data.since));
    case 'imminently_dangerous':
      return f.imminently_dangerous.text(day(data.since));
    default:
      return null;
  }
}

/** Flags from the owner's live property record: absentee and possible estate, for private owners only. */
export function ownerFlags(
  property: { address: string | null; names: string[]; mailingStreet: string | null; mailingCityState: string | null; mailingZip: string | null },
  isPrivateOwner: boolean,
): OwnerFlag[] {
  if (!isPrivateOwner) return [];
  const out: OwnerFlag[] = [];
  const found = absentee(property.address, property.mailingStreet, property.mailingCityState, property.mailingZip);
  if (found) out.push(make('absentee', absenteeText(found)));
  if (possibleEstate(property.names)) out.push(make('possible_estate', f.possible_estate.text));
  return out;
}

/** Flags from the live deed history: sheriff sales, years since the last sale (private owners), fast resales. */
export function transferFlags(
  history: Transfer[],
  opaSale: { date: string | null; price: number | null } | null,
  isPrivateOwner: boolean,
  asOf: string,
): OwnerFlag[] {
  const out: OwnerFlag[] = [];
  const sheriff = sheriffSales(history, asOf);
  if (sheriff.length) out.push(make('sheriff_sales', sheriffText(sheriff)));
  if (isPrivateOwner) {
    const sale = lastSale(history, opaSale?.date ?? null, opaSale?.price ?? null, asOf);
    out.push(make('years_since_sale', sale.known ? f.years_since_sale.lastSold(sale.year) : f.years_since_sale.notSoldSince(sale.year)));
  }
  const resales = fastResales(history, asOf);
  if (resales) out.push(make('fast_resales', resaleText(resales)));
  return out;
}

/** Flags from the live L&I timeline: open violations, unsafe, imminently dangerous. */
export function liFlags(events: LiEvent[]): OwnerFlag[] {
  return liFactFlags(liFacts(events));
}

/** The L&I flags for a summary of the timeline. */
export function liFactFlags(li: LiFacts): OwnerFlag[] {
  const out: OwnerFlag[] = [];
  const day = (d: string | null) => (d ? formatDate(d) : null);
  if (li.openViolations > 0) out.push(make('open_violations', violationsText(li)));
  if (li.unsafeSince !== null) out.push(make('unsafe', f.unsafe.text(day(li.unsafeSince))));
  if (li.dangerousSince !== null) out.push(make('imminently_dangerous', f.imminently_dangerous.text(day(li.dangerousSince))));
  return out;
}

/** Flags in the order of FLAG_IDS, unknown ids last. */
export function sortFlags<T extends { id: string }>(flags: T[]): T[] {
  const rank = (id: string) => {
    const i = (FLAG_IDS as readonly string[]).indexOf(id);
    return i < 0 ? FLAG_IDS.length : i;
  };
  return [...flags].sort((a, b) => rank(a.id) - rank(b.id));
}

/** The deed fraud notice's links: Fraud Guard sign up and the City's automated deed check. */
export function deedFraudLinks(): Link[] {
  return [link(o.fraudGuard, FRAUD_GUARD_URL), link(o.deedCheck, DEED_FRAUD_CHECK_URL)];
}

/** Help for owners and families, shown with any flag on a privately owned parcel. */
export function helpLinks(): Link[] {
  return [link(o.tangledTitle, TANGLED_TITLE_FUND_URL), link(o.fraudGuard, FRAUD_GUARD_URL)];
}
