// The displacement watch (M4.1; docs/DESIGN.md section 5.3, docs/ETHICS.md "Displacement",
// docs/CONTRACTS.md sections 3, 4 and 6): areas with signs that prices are rising. It is a
// caution, never a priority: it changes no score and no order.
//
// Where a greening suggestion sits in a watch area, its card adds the ETHICS.md text with the
// area's signs and links to ways of protecting neighbors; elsewhere the card keeps the one line
// caution (decision D12 of docs/VERIFICATION.md, kept by the orchestrator as protective). A place
// knows its watch area from `dw` on its tile (lots and SEPTA's stops) or `displacement.signs` in
// its lot dossier, the same bits as the area's `w`.

import type { Manifest } from '../data/manifest.ts';
import type { Registry, Route } from '../registry/types.ts';
import { formatNumber, strings } from '../strings.ts';

/** The signs, as bits. They never change meaning (placekeepers.derive.displacement.SIGNS). */
export const SIGNS = { prices: 1, companies: 2, assessments: 4, renters: 8, mva: 16 } as const;
export type SignId = keyof typeof SIGNS;
export const SIGN_ORDER: readonly SignId[] = ['prices', 'assessments', 'mva', 'companies', 'renters'];
/** The signs that say prices are rising; a watch area has at least one of them. */
export const PRICE_SIGNS = SIGNS.prices | SIGNS.assessments | SIGNS.mva;

/** The routes that protect neighbors, in the order the cards list them (registry/routes.yaml). */
export const PROTECTION_ROUTES = [
  'neighborhood_gardens_trust',
  'community_land_trust',
  'homestead_exemption',
  'longtime_owner_occupants',
  'tangled_title_help',
] as const;

/** At least two signs, one of them about prices: the pipeline's rule (is_watch). */
export function isWatch(bits: number): boolean {
  let count = 0;
  for (const bit of Object.values(SIGNS)) if (bits & bit) count += 1;
  return count >= 2 && (bits & PRICE_SIGNS) !== 0;
}

function bitsOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isInteger(n) || n <= 0 || n > 31) return null;
  return isWatch(n) ? n : null;
}

/**
 * The signs of the watch area a place lies in, or null outside every watch area: the tile's `dw`
 * when the map has the place, else its lot dossier's `displacement.signs`.
 */
export function watchSigns(tile: Record<string, unknown> | null | undefined, dossierSigns?: number | null): number | null {
  return bitsOf(tile?.dw) ?? bitsOf(dossierSigns);
}

export function signIds(bits: number): SignId[] {
  return SIGN_ORDER.filter((id) => (bits & SIGNS[id]) !== 0);
}

/** The signs in words, joined into one clause. */
export function signsText(bits: number): string {
  const words = signIds(bits).map((id) => strings.displacement.signShort[id]);
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join('; ')}; and ${words.at(-1)}`;
}

export interface ProtectionLink {
  id: string;
  label: string;
  url: string;
  checked: string;
}

/** The ways to protect neighbors, each with the official page it links to and when it was checked. */
export function protectionLinks(registry: Registry): ProtectionLink[] {
  const out: ProtectionLink[] = [];
  for (const id of PROTECTION_ROUTES) {
    const route: Route | undefined = registry.routes.find((r) => r.id === id);
    const link = route?.links[0];
    if (!route || !link) continue;
    out.push({ id, label: strings.displacement.protectionLabels[id] ?? route.label, url: link.url, checked: route.last_checked });
  }
  return out;
}

/** What a greening card says about the watch area it sits in. */
export interface WatchNote {
  signs: number;
  text: string;
  links: ProtectionLink[];
}

export function watchNote(registry: Registry, bits: number | null): WatchNote | null {
  if (bits === null) return null;
  return { signs: bits, text: strings.displacement.inWatch(signsText(bits)), links: protectionLinks(registry) };
}

// The manifest's `displacement` block -------------------------------------------------------

export interface WatchCity {
  p0: number | null;
  p1: number | null;
  pc: number | null;
  cb: number | null;
  ac: number | null;
  rp: number | null;
}

export interface WatchThresholds {
  price_points: number;
  company_points: number;
  assessment_points: number;
  renter_pct: number;
  min_sales: number;
  min_assessed: number;
  min_occupied: number;
}

export interface WatchSummary {
  periods: { earlier_from: string; earlier_to: string; recent_from: string; recent_to: string } | null;
  assessment_years: [number, number] | null;
  survey_years: [number, number] | null;
  mva: string | null;
  city: WatchCity;
  thresholds: WatchThresholds;
  areas: { tracts: number | null; watch: number | null };
}

const DEFAULT_THRESHOLDS: WatchThresholds = {
  price_points: 25,
  company_points: 15,
  assessment_points: 30,
  renter_pct: 60,
  min_sales: 50,
  min_assessed: 50,
  min_occupied: 100,
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pair(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [a, b] = v as unknown[];
  return typeof a === 'number' && typeof b === 'number' ? [a, b] : null;
}

/** The manifest's `displacement` block, or null when the watch was not measured. */
export function parseWatchSummary(raw: unknown): WatchSummary | null {
  if (!isObj(raw)) return null;
  const city = isObj(raw.city) ? raw.city : {};
  const t = isObj(raw.thresholds) ? raw.thresholds : {};
  const periods = isObj(raw.periods) ? raw.periods : null;
  const day = (k: string): string | null => (periods && typeof periods[k] === 'string' ? (periods[k] as string) : null);
  const p = { earlier_from: day('earlier_from'), earlier_to: day('earlier_to'), recent_from: day('recent_from'), recent_to: day('recent_to') };
  const areas = isObj(raw.areas) ? raw.areas : {};
  const thresholds = { ...DEFAULT_THRESHOLDS };
  for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof WatchThresholds)[]) {
    const value = num(t[key]);
    if (value !== null) thresholds[key] = value;
  }
  return {
    periods: Object.values(p).every((v) => v !== null) ? (p as WatchSummary['periods']) : null,
    assessment_years: pair(raw.assessment_years),
    survey_years: pair(raw.survey_years),
    mva: typeof raw.mva === 'string' ? raw.mva : null,
    city: { p0: num(city.p0), p1: num(city.p1), pc: num(city.pc), cb: num(city.cb), ac: num(city.ac), rp: num(city.rp) },
    thresholds,
    areas: { tracts: num(areas.tracts), watch: num(areas.watch) },
  };
}

export function watchSummaryOf(manifest: Manifest | null): WatchSummary | null {
  return manifest?.displacement ?? null;
}

// A tapped watch area ----------------------------------------------------------------------------

export interface SignRow {
  id: SignId;
  /** True when this sign holds here. */
  holds: boolean;
  title: string;
  /** What was measured here, against the city; or why it could not be measured. */
  text: string;
}

export interface AreaView {
  title: string;
  place: string | null;
  holding: SignRow[];
  other: SignRow[];
}

function year(day: string | undefined | null): string {
  return day ? day.slice(0, 4) : '';
}

function money(n: number): string {
  return `$${formatNumber(Math.round(n))}`;
}

/** The census tract's number as people write it: 42101016000 is tract 160, 42101000101 is 1.01. */
export function tractNumber(geoid: string): string {
  const code = geoid.slice(-6);
  if (!/^\d{6}$/.test(code)) return geoid;
  const whole = String(Number(code.slice(0, 4)));
  const part = code.slice(4);
  return part === '00' ? whole : `${whole}.${part}`;
}

/** Everything a tapped watch area shows: the signs that hold, then the others measured. */
export function describeArea(properties: Record<string, unknown>, summary: WatchSummary | null): AreaView {
  const d = strings.displacement;
  const bits = num(properties.w) ?? 0;
  const id = typeof properties.id === 'string' ? properties.id : '';
  const place = typeof properties.nm === 'string' && properties.nm ? properties.nm : null;
  const city = summary?.city ?? { p0: null, p1: null, pc: null, cb: null, ac: null, rp: null };
  const t = summary?.thresholds ?? DEFAULT_THRESHOLDS;
  const periods = summary?.periods ?? null;
  const span = periods ? d.span(year(periods.earlier_from), year(periods.earlier_to), year(periods.recent_from), year(periods.recent_to)) : '';
  const rows: SignRow[] = [];

  const n0 = num(properties.n0) ?? 0;
  const n1 = num(properties.n1) ?? 0;
  const pc = num(properties.pc);
  const p0 = num(properties.p0);
  const p1 = num(properties.p1);
  rows.push({
    id: 'prices',
    holds: (bits & SIGNS.prices) !== 0,
    title: d.signTitle.prices,
    text:
      pc !== null && p0 !== null && p1 !== null
        ? d.pricesText(money(p0), money(p1), pc, city.pc, span)
        : d.tooFewSales(n0, n1, t.min_sales),
  });
  const cb = num(properties.cb);
  rows.push({
    id: 'companies',
    holds: (bits & SIGNS.companies) !== 0,
    title: d.signTitle.companies,
    text: cb !== null ? d.companiesText(cb, n1, city.cb) : d.tooFewSales(n0, n1, t.min_sales),
  });
  const ac = num(properties.ac);
  const years = summary?.assessment_years;
  rows.push({
    id: 'assessments',
    holds: (bits & SIGNS.assessments) !== 0,
    title: d.signTitle.assessments,
    text: ac !== null ? d.assessmentsText(ac, num(properties.ah) ?? 0, city.ac, years ?? null) : d.tooFewHomes,
  });
  const rp = num(properties.rp);
  rows.push({
    id: 'renters',
    holds: (bits & SIGNS.renters) !== 0,
    title: d.signTitle.renters,
    text: rp !== null ? d.rentersText(rp, city.rp, summary?.survey_years ?? null) : d.tooFewHouseholds,
  });
  const mb = num(properties.mb) ?? 0;
  const mr = num(properties.mr) ?? 0;
  rows.push({
    id: 'mva',
    holds: (bits & SIGNS.mva) !== 0,
    title: d.signTitle.mva,
    text: mb > 0 ? d.mvaText(mr, mb, summary?.mva ?? null) : d.mvaNone,
  });
  const order = (row: SignRow) => SIGN_ORDER.indexOf(row.id);
  return {
    title: d.areaTitle(tractNumber(id)),
    place,
    holding: rows.filter((r) => r.holds).sort((a, b) => order(a) - order(b)),
    other: rows.filter((r) => !r.holds).sort((a, b) => order(a) - order(b)),
  };
}
