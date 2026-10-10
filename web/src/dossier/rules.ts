// Rules for this lot (M4.6, issue #42; docs/DESIGN.md section 5.6): what City and federal records
// say applies to a lot, in plain words, leading with the lawful step.
//
//   * historic designation: the Historical Commission's districts and the Philadelphia Register of
//     Historic Places, with "ask them first" and the Commission's phone;
//   * zoning: the base district and each overlay in plain words, with its Zoning Code section, a
//     pending bill and a sunset day;
//   * brownfields: the owner's sentence word for word, with the EPA's record and a soil test;
//   * appeals and hearings: every appeal as the City publishes it, a hearing still to come first,
//     with who filed it and the owner named (this lot's page only, docs/ETHICS.md "Appeals and
//     hearings"), the registered community organization the City told and how to take part.
//
// Nothing here says whether a lot can or cannot be built on, and nothing calls a place clean or
// safe. Everything is a plain function of its inputs.

import { atlasZoningUrl, epaRecordUrl, FIND_HISTORIC_URL, HISTORIC_PROJECT_REVIEW_URL, HISTORICAL_COMMISSION_URL, liHistoryUrl, TAKE_PART_URLS, ZONING_HELP_URL } from '../config/links.ts';
import { formatDate, strings } from '../strings.ts';
import { isUpcoming, nextHearing } from './appeals.ts';
import { cityWords, plain } from './plain.ts';
import type { Appeal, AppealBoard, Link, LotRules, Overlay, RulePart } from './types.ts';

const r = () => strings.dossier.rules;

/** "15:30" as "3:30 PM". */
export function clockWords(clock: string | null): string | null {
  if (!clock) return null;
  const [h, m] = clock.split(':').map(Number) as [number, number];
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function day(value: string | null): string | null {
  return value ? (formatDate(value) ?? value) : null;
}

/** The overlay symbols of the Council district overlays ("Fifth District Overlay District"). */
const COUNCIL_NAME = /\b(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth) District Overlay/i;

/** What kind of rule an overlay is, in plain words: never what it allows. */
export function overlayMeaning(overlay: Pick<Overlay, 'symbol' | 'name' | 'type'>): string {
  const m = r().overlayMeaning;
  const symbol = (overlay.symbol ?? '').toUpperCase();
  if (m[symbol]) return m[symbol]!;
  const name = overlay.name;
  if (COUNCIL_NAME.test(name)) return m.council!;
  if (overlay.type === 3 || /impervious/i.test(name)) return m.coverage!;
  if (/flood/i.test(name)) return m.flood!;
  if (/steep slope/i.test(name)) return m.steep!;
  if (/animal husbandry/i.test(name)) return m.animal!;
  if (/child care/i.test(name)) return m.childCare!;
  if (/dispensary/i.test(name)) return m.dispensary!;
  if (/\bsigns?\b|display/i.test(name)) return m.signs!;
  if (/parking/i.test(name)) return m.parking!;
  if (/loading/i.test(name)) return m.loading!;
  if (/SP-INS|institutional/i.test(name)) return m.institutional!;
  if (/pump station/i.test(name)) return m.pump!;
  if (/floor area/i.test(name)) return m.floorArea!;
  if (/waterfront setback/i.test(name)) return m.waterfront!;
  return overlay.type === 1 ? m.overlay! : m.supplemental!;
}

/** The City's kind of appeal in plain words: "ZBA Permit Denial - Variance" reads "Permit denial, variance". */
export function appealKind(appeal: Pick<Appeal, 'type' | 'application' | 'board'>): string | null {
  const type = (appeal.type ?? '').replace(/^(ZBA|LIRB(-[A-Z])?|BBS|TRB|PAB|BSFP)\b/i, '').replace(/^[\s,:-]+/, '');
  if (type) return cityWords(type);
  // The older system writes only codes (RB_ZBA); another board is named by its own words.
  if (appeal.board === 'other' && appeal.application && !/^RB_/i.test(appeal.application)) return cityWords(appeal.application);
  return null;
}

export function decisionWords(decision: string | null): string | null {
  if (!decision) return null;
  return r().decisions[decision.toUpperCase()] ?? cityWords(decision);
}

export interface OverlayView {
  name: string;
  kind: string;
  meaning: string;
  link: Link | null;
  sunset: string | null;
  pending: { text: string; link: Link | null } | null;
}

export interface AppealView {
  board: string;
  boardId: AppealBoard;
  kind: string | null;
  upcoming: boolean;
  /** Filed, the hearing and the decision day, in plain words. */
  dates: string[];
  status: string | null;
  decision: string | null;
  rco: string | null;
  filedBy: string | null;
  ownerNamed: string | null;
  takePart: Link;
}

export interface RulesView {
  intro: string;
  /** Said when the lot has no dossier, so its rules are not known here. */
  notOnList: string | null;
  /** A hearing still to come, for the top of the page. */
  hearing: { text: string; takePart: Link } | null;
  historic: { lines: string[]; askFirst: string; contact: string; confirm: string; links: Link[] } | null;
  zoning: {
    base: string | null;
    basePending: Link | null;
    overlaysIntro: string;
    overlays: OverlayView[];
    note: string;
    links: Link[];
  } | null;
  brownfield: { text: string; sites: { text: string; link: Link }[]; more: string | null; note: string; links: Link[] } | null;
  /** Rules the weekly copy was built without: say so, never that they do not apply. */
  missing: string[];
  appeals: {
    items: AppealView[];
    /** "No appeals on record", only when the records were read. */
    empty: string | null;
    /** The records are not known: the weekly copy lacks them and the City was not asked, or did not answer. */
    missing: { text: string; offerLive: boolean; retry: boolean } | null;
    grounds: Link | null;
    namesNote: string | null;
  };
  links: Link[];
}

export interface RulesInput {
  opa: string;
  address: string | null;
  /** The dossier's rules, or null; `listed` false for a parcel without a dossier. */
  rules: LotRules | null;
  listed: boolean;
  missing: RulePart[];
  overlays: Record<string, Overlay>;
  /** The appeals to show (live or from the weekly copy), or null when not known. */
  appeals: Appeal[] | null;
  /** Why the appeals are not known, when they are not. */
  appealsUnknown: { offerLive: boolean; retry: boolean } | null;
  today: string;
}

/** A district name as people write it: the Register sometimes writes it in capitals. */
function districtWords(name: string): string {
  const text = plain(name);
  return text === text.toUpperCase() ? text.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) : text;
}

/**
 * Whether the Register's district name and a district's name are the same district: the two City
 * layers write some names differently ("Ridge Ave Roxborough", "Ridge Avenue Roxborough").
 */
export function sameDistrict(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(historic|district|thematic|the)\b/g, '')
      .replace(/[^a-z0-9]/g, '');
  const x = n(a);
  const y = n(b);
  return x === y || x.startsWith(y) || y.startsWith(x) || (x.length >= 6 && x.slice(0, 6) === y.slice(0, 6));
}

function historicView(rules: LotRules | null): RulesView['historic'] {
  if (!rules || (!rules.districts.length && !rules.register)) return null;
  const s = r();
  const reg = rules.register;
  // The Register's own district for this lot, matched to a district the lot lies in when the
  // names agree, or when there is only one.
  const match = reg?.district ? (rules.districts.find((d) => sameDistrict(d.name, reg.district!)) ?? (rules.districts.length === 1 ? rules.districts[0]! : null)) : null;
  const lines: string[] = [];
  for (const d of rules.districts) {
    // A district the layer gives no day for takes the Register's day for it.
    const date = d.date ?? (d === match ? (reg?.districtDate ?? null) : null);
    lines.push(s.inDistrict(s.districtName(districtWords(d.name)), day(date)));
  }
  if (reg) {
    if (reg.date) lines.push(s.listed(day(reg.date)!));
    else if (reg.individual) lines.push(s.listedNoDate);
    else if (reg.district) lines.push(s.listedInDistrict(s.districtName(districtWords(match ? match.name : reg.district))));
    else lines.push(s.listedNoDate);
  }
  return {
    lines,
    askFirst: s.askFirst,
    contact: s.contact,
    confirm: s.confirm,
    links: [
      { label: s.commissionSite, url: HISTORICAL_COMMISSION_URL },
      { label: s.projectReview, url: HISTORIC_PROJECT_REVIEW_URL },
      { label: s.findHistoric, url: FIND_HISTORIC_URL },
    ],
  };
}

function overlayView(overlay: Overlay): OverlayView {
  const s = r();
  return {
    name: plain(overlay.name) ?? overlay.name,
    kind: s.overlayKinds[overlay.type] ?? s.overlayKinds[2]!,
    meaning: overlayMeaning(overlay),
    link: overlay.link ? { label: s.readRule(overlay.section), url: overlay.link } : null,
    sunset: overlay.sunset ? s.sunset(day(overlay.sunset)!) : null,
    pending: overlay.pendingBill || overlay.pendingUrl ? { text: s.pending(overlay.pendingBill), link: overlay.pendingUrl ? { label: s.readBill, url: overlay.pendingUrl } : null } : null,
  };
}

function zoningView(input: RulesInput): RulesView['zoning'] {
  const s = r();
  const rules = input.rules;
  const overlays = (rules?.overlays ?? [])
    .map((key) => input.overlays[key])
    .filter((o): o is Overlay => !!o)
    .sort((a, b) => (a.type || 9) - (b.type || 9) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (!rules?.zoning && !overlays.length && input.missing.includes('overlays')) return null;
  const group = rules?.zoning?.group ? (s.zoningGroups[rules.zoning.group.toUpperCase()] ?? null) : null;
  return {
    base: rules?.zoning ? s.base(rules.zoning.code, group) : null,
    basePending: rules?.zoning?.pendingUrl ? { label: s.readBill, url: rules.zoning.pendingUrl } : null,
    overlaysIntro: overlays.length ? s.overlaysIntro(overlays.length) : input.missing.includes('overlays') ? '' : s.noOverlays,
    overlays: overlays.map(overlayView),
    note: s.zoningNote,
    links: [
      { label: s.atlasZoning, url: atlasZoningUrl(input.opa) },
      { label: s.zoningHelp, url: ZONING_HELP_URL },
    ],
  };
}

function brownfieldView(rules: LotRules | null): RulesView['brownfield'] {
  if (!rules || !rules.brownfields.length) return null;
  const s = r();
  return {
    text: s.brownfield,
    sites: rules.brownfields.map((b) => {
      const name = plain(b.name ?? b.address ?? '') || s.epaRecord;
      const feet = b.meters === null ? null : Math.round((b.meters * 3.28084) / 10) * 10;
      return {
        text: feet === null ? name : feet < 10 ? `${name}, ${s.onLot}` : s.brownfieldSite(name, feet),
        link: { label: s.epaRecord, url: epaRecordUrl(b.id) },
      };
    }),
    more: rules.brownfieldsMore > 0 ? s.brownfieldMore(rules.brownfieldsMore) : null,
    note: s.brownfieldNote,
    links: [],
  };
}

export function appealView(appeal: Appeal, today: string): AppealView {
  const s = r();
  const upcoming = isUpcoming(appeal, today);
  const dates: string[] = [];
  if (appeal.filed) dates.push(s.filed(day(appeal.filed)!));
  if (appeal.hearing) dates.push(s.hearingOn(day(appeal.hearing)!, clockWords(appeal.hearingTime), upcoming));
  if (appeal.decided) dates.push(s.decidedOn(day(appeal.decided)!));
  return {
    board: s.boards[appeal.board] ?? s.boards.other!,
    boardId: appeal.board,
    kind: appealKind(appeal),
    upcoming,
    dates,
    status: appeal.status ? s.status(cityWords(appeal.status)) : null,
    decision: appeal.decision ? s.decision(decisionWords(appeal.decision)!) : null,
    rco: appeal.rco ? s.rco(plain(appeal.rco) ?? appeal.rco) : null,
    filedBy: appeal.appellant ? (plain(appeal.appellant) ?? appeal.appellant) : null,
    ownerNamed: appeal.owner ? (plain(appeal.owner) ?? appeal.owner) : null,
    takePart: { label: s.takePart[appeal.board] ?? s.takePart.other!, url: TAKE_PART_URLS[appeal.board] ?? TAKE_PART_URLS.other! },
  };
}

/** The hearing still to come, for the top of the page, or null. */
export function hearingNotice(appeals: Appeal[] | null, today: string): RulesView['hearing'] {
  const next = appeals ? nextHearing(appeals, today) : null;
  if (!next) return null;
  const s = r();
  return {
    text: s.hearingSet(s.hearingBoard[next.board] ?? s.hearingBoard.other!, day(next.hearing)!, clockWords(next.hearingTime)),
    takePart: { label: s.takePart[next.board] ?? s.takePart.other!, url: TAKE_PART_URLS[next.board] ?? TAKE_PART_URLS.other! },
  };
}

export function buildRules(input: RulesInput): RulesView {
  const s = r();
  const rules = input.listed ? input.rules : null;
  // A hearing still to come leads the list; then newest first, as the City's records come.
  const appeals = input.appeals ? [...input.appeals].sort((a, b) => Number(isUpcoming(b, input.today)) - Number(isUpcoming(a, input.today))) : null;
  const items = appeals ? appeals.map((a) => appealView(a, input.today)) : [];
  const missing = input.listed ? (['historic', 'overlays', 'brownfields'] as const).filter((part) => input.missing.includes(part)).map((part) => s.missing[part]!) : [];
  return {
    intro: s.intro,
    notOnList: input.listed ? null : s.notOnList,
    hearing: hearingNotice(appeals, input.today),
    historic: historicView(rules),
    zoning: input.listed ? zoningView(input) : null,
    brownfield: brownfieldView(rules),
    missing,
    appeals: {
      items,
      empty: appeals && !appeals.length ? s.noAppeals : null,
      missing: !appeals && input.appealsUnknown ? { text: s.appealsMissing, ...input.appealsUnknown } : null,
      grounds: items.length && input.address ? { label: s.grounds, url: liHistoryUrl(input.address) } : null,
      namesNote: items.some((a) => a.filedBy || a.ownerNamed) ? s.namesNote : null,
    },
    links: input.listed ? [] : [{ label: s.atlasZoning, url: atlasZoningUrl(input.opa) }, { label: s.findHistoric, url: FIND_HISTORIC_URL }],
  };
}
