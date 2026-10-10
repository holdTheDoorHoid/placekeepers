// What a tap on the map's rules layers shows (M4.6, issue #42), from the short properties of
// tiles/rules.pmtiles (docs/CONTRACTS.md section 4): a historic district or property, every zoning
// overlay at the spot, a hearing still to come, or an EPA brownfield site. Plain functions of the
// properties, so tests can check every case. A hearing carries no names: who filed the appeal is
// on the lot's own page only (docs/ETHICS.md, "Appeals and hearings").

import { epaRecordUrl, EPA_GARDEN_GUIDE_URL, FIND_HISTORIC_URL, HISTORICAL_COMMISSION_URL, SOIL_TEST_URL, TAKE_PART_URLS } from '../config/links.ts';
import { appealKind, clockWords, overlayMeaning } from '../dossier/rules.ts';
import { cityWords, plain } from '../dossier/plain.ts';
import type { AppealBoard, Link } from '../dossier/types.ts';
import { formatDate, strings } from '../strings.ts';

type Props = Record<string, unknown>;

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? plain(v.replace(/\s+/g, ' ').trim()) : null;
}

function day(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDate(v) : null;
}

function int(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

const m = () => strings.rulesMap;
const r = () => strings.dossier.rules;

export interface RuleCard {
  title: string;
  lines: string[];
  links: Link[];
  /** The parcel to open, for a hearing. */
  opa: string | null;
}

function historicLinks(): Link[] {
  return [
    { label: r().commissionSite, url: HISTORICAL_COMMISSION_URL },
    { label: r().findHistoric, url: FIND_HISTORIC_URL },
  ];
}

export function districtCard(p: Props): RuleCard {
  const name = text(p.nm) ?? m().legend.district;
  const date = day(p.dd);
  return { title: name, lines: [date ? m().designated(date) : m().noDate, r().askFirst, r().contact], links: historicLinks(), opa: null };
}

export function propertyCard(p: Props): RuleCard {
  const lines: string[] = [];
  const listed = day(p.d);
  if (listed) lines.push(m().listedOn(listed));
  else if (int(p.i) === 1) lines.push(m().listedAlone);
  const district = text(p.dn);
  if (district) lines.push(m().inDistrict(r().districtName(district), day(p.dd)));
  lines.push(r().askFirst, r().contact);
  return { title: text(p.ad) ?? m().propertyTitle, lines: [m().propertyTitle + '.', ...lines], links: historicLinks(), opa: null };
}

export function overlayCard(p: Props): RuleCard {
  const name = text(p.nm) ?? m().legend.overlay;
  const type = int(p.t) ?? 0;
  const lines = [overlayMeaning({ name, symbol: text(p.sy), type })];
  const sunset = day(p.su);
  if (sunset) lines.push(r().sunset(sunset));
  if (text(p.pb) || text(p.pu)) lines.push(r().pending(text(p.pb)));
  const links: Link[] = [];
  const link = typeof p.cl === 'string' && /^https:\/\//.test(p.cl) ? p.cl : null;
  if (link) links.push({ label: r().readRule(text(p.cs)), url: link });
  const bill = typeof p.pu === 'string' && /^https:\/\//.test(p.pu) ? p.pu : null;
  if (bill) links.push({ label: r().readBill, url: bill });
  return { title: name, lines, links, opa: null };
}

const BOARDS: Record<number, AppealBoard> = { 1: 'zoning', 2: 'li_review', 3: 'building', 0: 'other' };

export function hearingCard(p: Props): RuleCard {
  const board = BOARDS[int(p.b) ?? 0] ?? 'other';
  const boardName = r().boards[board] ?? r().boards.other!;
  const date = day(p.d);
  const time = typeof p.tm === 'string' && /^\d{2}:\d{2}$/.test(p.tm) ? clockWords(p.tm) : null;
  const lines: string[] = [];
  if (date) lines.push(m().hearingWhen(date, time));
  const kind = appealKind({ type: typeof p.ty === 'string' ? p.ty : null, application: null, board });
  if (kind) lines.push(kind);
  const address = text(p.ad);
  if (address) lines.push(m().about(address));
  const rco = text(p.rco);
  if (rco) lines.push(m().rco(rco));
  lines.push(m().namesNote);
  const opa = typeof p.id === 'string' && /^\d{9}$/.test(p.id) ? p.id : null;
  return {
    title: m().hearingTitle(boardName),
    lines,
    links: [{ label: r().takePart[board] ?? r().takePart.other!, url: TAKE_PART_URLS[board] ?? TAKE_PART_URLS.other! }],
    opa,
  };
}

export function brownfieldCard(p: Props): RuleCard {
  const name = text(p.nm);
  const address = text(p.ad);
  const lines: string[] = [r().brownfield, r().brownfieldNote];
  if (address && address !== name) lines.unshift(address);
  const links: Link[] = [];
  if (typeof p.id === 'string' && /^\d{6,15}$/.test(p.id)) links.push({ label: r().epaRecord, url: epaRecordUrl(p.id) });
  links.push({ label: r().soilTest, url: SOIL_TEST_URL }, { label: r().gardenGuide, url: EPA_GARDEN_GUIDE_URL });
  return { title: name ? cityWords(name) : m().brownfieldTitle, lines, links, opa: null };
}
