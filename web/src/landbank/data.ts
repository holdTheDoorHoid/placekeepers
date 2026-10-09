// "The Land Bank in numbers" (M4.4, issue #40): reads tables/land_bank.json (docs/CONTRACTS.md
// section 9) and turns it into what the page shows and what its CSV downloads hold. Aggregates
// only: the file has counts, shares and medians, never a name, an address or a parcel number
// (docs/ETHICS.md), and nothing here adds any.

import { csvCell } from '../places/export.ts';

/** One series of a chart: its key, its label and its color. */
export interface Series {
  key: string;
  label: string;
  color: string;
}

/**
 * Chart colors, in a fixed order that follows the series, never its rank: the charting rules'
 * reference categorical palette, first four slots, checked with its validator on white (adjacent
 * pairs pass; the third and fourth sit below 3 to 1 on white, so every chart has its table). A
 * single series takes the lot page's assessment chart blue.
 */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] as const;
export const SINGLE_COLOR = '#1f6fb2';

/** The table's place under the data root. */
export const LAND_BANK_TABLE = 'tables/land_bank.json';
export const SCHEMA = 1;

/** The land agencies by the City's codes, in the order the page lists them. */
export const AGENCIES = ['PLB', 'PRA', 'PHDC', 'PUB'] as const;
export type Agency = (typeof AGENCIES)[number];
export type AgencyChoice = 'all' | Agency;
export const AGENCY_CHOICES: AgencyChoice[] = ['all', ...AGENCIES];

/** Buyer groups; `unknown` is shown in the tables only (a handful of deeds). */
export const BUYERS = ['individual', 'company', 'nonprofit', 'public', 'unknown'] as const;
export type Buyer = (typeof BUYERS)[number];
export const CHARTED_BUYERS = ['individual', 'company', 'nonprofit', 'public'] as const satisfies readonly Buyer[];

export interface PriceBlock {
  median: number | null;
  priced: number;
  nominal: number;
  none: number;
}

export interface Block {
  n: number;
  deeds: number;
  moved_out: number;
  moved_in: number;
  buyers: Record<Buyer, number>;
  programs: { side_yard: number; other: number };
  price: PriceBlock;
}

export interface YearBlock extends Block {
  year: number;
}

export interface DistrictRow {
  /** Today's council district, 1 to 10, or null for a deed with no location. */
  district: number | null;
  n: number;
  years: number[];
}

export interface AgencyStats {
  years: YearBlock[];
  total: Block;
  districts: DistrictRow[];
}

export interface ProgramFyRow {
  fy: number;
  side_yards: number | null;
  gardens: number | null;
  business: number | null;
  homes_below_30: number | null;
  homes_60_80: number | null;
  homes_80_120: number | null;
  homes_market: number | null;
  inferred_plb: number;
  inferred_all: number;
}

export interface ListedWeek {
  date: string;
  listed: number;
  parcels: number;
  side_yard: number;
  by_agency: Record<string, number>;
  by_status: Record<string, number>;
}

export interface LandBankTable {
  schema: number;
  generated: string;
  deeds: {
    first: string | null;
    last: string | null;
    fetched: string;
    years: number[];
    partial_year: number | null;
    nominal_max: number;
    counted: number;
    follow_ups: number;
    moved: number;
    agreements: number;
    other: number;
  };
  agencies: Record<AgencyChoice, AgencyStats>;
  programs_fy: { edited: string; rows: ProgramFyRow[] } | null;
  listed: { weeks: ListedWeek[] } | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The table when it has the shape this page reads, else null (the page then says it is missing). */
export function parseTable(data: unknown): LandBankTable | null {
  if (!isObject(data) || data.schema !== SCHEMA) return null;
  const deeds = data.deeds;
  const agencies = data.agencies;
  if (!isObject(deeds) || !Array.isArray(deeds.years) || !isObject(agencies)) return null;
  for (const choice of AGENCY_CHOICES) {
    const stats = agencies[choice];
    if (!isObject(stats) || !Array.isArray(stats.years) || !isObject(stats.total) || !Array.isArray(stats.districts)) return null;
  }
  return data as unknown as LandBankTable;
}

export async function loadTable(dataBase: string, fetcher: typeof fetch = fetch): Promise<LandBankTable | 'missing' | 'failed'> {
  try {
    const response = await fetcher(`${dataBase}${LAND_BANK_TABLE}`);
    if (response.status === 404) return 'missing';
    if (!response.ok) return 'failed';
    return parseTable(await response.json()) ?? 'failed';
  } catch {
    return 'failed';
  }
}

/** A share in whole percent, or null when there is nothing to share. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((100 * part) / whole) : null;
}

/** The years from the first one with a conveyance, so a chart of the Land Bank (which began
 * conveying in 2017) does not open with empty years. */
export function yearsFromFirst(stats: AgencyStats): YearBlock[] {
  const first = stats.years.findIndex((y) => y.n > 0);
  return first < 0 ? [] : stats.years.slice(first);
}

/** Properties per year for each agency: one series per agency, for the stacked chart. */
export function byAgencyYears(table: LandBankTable, choice: AgencyChoice): { year: number; values: Record<Agency, number> }[] {
  const years = yearsFromFirst(table.agencies[choice]).map((y) => y.year);
  return years.map((year) => {
    const values = {} as Record<Agency, number>;
    for (const agency of AGENCIES) {
      values[agency] = choice === 'all' || choice === agency ? (table.agencies[agency].years.find((y) => y.year === year)?.n ?? 0) : 0;
    }
    return { year, values };
  });
}

/** The fiscal years the City's dashboard counted, beside our inference for the same years. */
export function programRows(table: LandBankTable): ProgramFyRow[] {
  return table.programs_fy?.rows ?? [];
}

// CSV downloads -------------------------------------------------------------------------------

export interface CsvNotes {
  /** The first line: the terms of use. */
  terms: string;
  /** What the file holds, and its sources and dates. */
  about: string[];
}

function csv(notes: CsvNotes, header: string[], rows: (string | number | null)[][]): string {
  const lines = [notes.terms, ...notes.about].map((note) => csvCell(`# ${note}`));
  lines.push(header.join(','));
  for (const row of rows) lines.push(row.map((value) => csvCell(value, typeof value !== 'number')).join(','));
  // A byte order mark, so spreadsheet programs read the text as UTF-8.
  return `﻿${lines.join('\r\n')}\r\n`;
}

const AGENCY_COLUMNS = { all: 'all four agencies', PLB: 'Land Bank', PRA: 'Redevelopment Authority', PHDC: 'PHDC', PUB: 'City' };

/** Every year for every agency: properties, deeds, moves between agencies, buyers, the side yard
 * inference and prices. One file holds the whole table's yearly numbers. */
export function yearsCsv(table: LandBankTable, notes: CsvNotes): string {
  const header = [
    'agency',
    'year',
    'properties_conveyed',
    'deeds',
    'moved_to_another_agency',
    'received_from_another_agency',
    'to_people',
    'to_companies',
    'to_nonprofits',
    'to_other_public_bodies',
    'to_unclear',
    'side_or_rear_yard_our_inference',
    'program_not_in_the_records',
    'with_a_price',
    'median_price_dollars',
    'price_100_dollars_or_less',
    'no_price_recorded',
    'year_complete',
  ];
  const rows: (string | number | null)[][] = [];
  for (const choice of AGENCY_CHOICES) {
    for (const y of table.agencies[choice].years) {
      rows.push([
        AGENCY_COLUMNS[choice],
        y.year,
        y.n,
        y.deeds,
        y.moved_out,
        y.moved_in,
        ...BUYERS.map((b) => y.buyers[b] ?? 0),
        y.programs.side_yard,
        y.programs.other,
        y.price.priced,
        y.price.median,
        y.price.nominal,
        y.price.none,
        y.year === table.deeds.partial_year ? 'no' : 'yes',
      ]);
    }
  }
  return csv(notes, header, rows);
}

/** Properties conveyed by council district (today's lines) and year, for every agency. */
export function districtsCsv(table: LandBankTable, notes: CsvNotes): string {
  const years = table.deeds.years;
  const header = ['agency', 'council_district', 'all_years', ...years.map(String)];
  const rows: (string | number | null)[][] = [];
  for (const choice of AGENCY_CHOICES) {
    for (const d of table.agencies[choice].districts) {
      rows.push([AGENCY_COLUMNS[choice], d.district === null ? 'no location' : d.district, d.n, ...d.years]);
    }
  }
  return csv(notes, header, rows);
}

/** The City's own counts by program and fiscal year, beside our inference. */
export function programsCsv(table: LandBankTable, notes: CsvNotes): string {
  const header = [
    'fiscal_year',
    'city_side_yards',
    'city_gardens_or_open_space',
    'city_business_expansion',
    'city_homes_below_30_percent_ami',
    'city_homes_60_to_80_percent_ami',
    'city_homes_80_to_120_percent_ami',
    'city_homes_market_rate',
    'our_inferred_side_yards_land_bank',
    'our_inferred_side_yards_all_four_agencies',
  ];
  const rows = programRows(table).map((r) => [
    r.fy,
    r.side_yards,
    r.gardens,
    r.business,
    r.homes_below_30,
    r.homes_60_80,
    r.homes_80_120,
    r.homes_market,
    r.inferred_plb,
    r.inferred_all,
  ]);
  return csv(notes, header, rows);
}

/** The weekly count of lots listed as available, by status and agency. */
export function listedCsv(table: LandBankTable, notes: CsvNotes, statusLabel: (status: string) => string = (s) => s): string {
  const weeks = table.listed?.weeks ?? [];
  const statuses = [...new Set(weeks.flatMap((w) => Object.keys(w.by_status)))].sort();
  const agencies = [...new Set(weeks.flatMap((w) => Object.keys(w.by_agency)))].sort();
  const header = [
    'date_fetched',
    'records_listed_as_available',
    'parcels_listed_as_available',
    'listed_records_open_to_a_side_yard',
    ...agencies.map((a) => `listed_${a}`),
    ...statuses.map((s) => `status: ${statusLabel(s)}`),
  ];
  const rows = weeks.map((w) => [
    w.date,
    w.listed,
    w.parcels,
    w.side_yard,
    ...agencies.map((a) => w.by_agency[a] ?? 0),
    ...statuses.map((s) => w.by_status[s] ?? 0),
  ]);
  return csv(notes, header, rows);
}
