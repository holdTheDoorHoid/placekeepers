// The lot dossier's data, as the web app holds it after reading a shard (docs/CONTRACTS.md, the
// dossier shards) or a live City lookup. Readers turn whatever arrives into these shapes, keeping
// only the fields the contract names, so nothing else can reach the page.

import type { Geometry } from 'geojson';
import type { LiGroups, ListRecord } from './timeline.ts';

export type VacancyKind = 'lot' | 'building';
export type Confidence = 'high' | 'medium' | 'low';

export const OWNER_TYPES = [
  'individual',
  'company',
  'city',
  'land_bank',
  'redevelopment_authority',
  'housing_authority',
  'nonprofit',
  'other_public',
  'unknown',
] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

/** Public bodies: they get mail at their offices and their holdings are listed by the City. */
export const PUBLIC_OWNER_TYPES: ReadonlySet<OwnerType> = new Set([
  'city',
  'land_bank',
  'redevelopment_authority',
  'housing_authority',
  'other_public',
]);

/** The `ot` codes of the parcel tiles (docs/CONTRACTS.md section 4). */
export const OWNER_TYPE_CODES: Record<OwnerType, number> = {
  unknown: 0,
  individual: 1,
  company: 2,
  city: 3,
  land_bank: 4,
  redevelopment_authority: 5,
  housing_authority: 6,
  nonprofit: 7,
  other_public: 8,
};

/**
 * The vacancy model's call for a parcel, with the same fields as its map tile (docs/CONTRACTS.md
 * section 4): the reasons as bits in `rs`, how many independent records agree in `n`, and the
 * years that go with some reasons. src/places/reasons.ts turns them into sentences.
 */
export interface Vacancy {
  kind: VacancyKind | null;
  confidence: Confidence | null;
  rs: number | null;
  n: number | null;
  dy: number | null;
  sy: number | null;
  ny: number | null;
}

export interface Link {
  label: string;
  url: string;
}

/** One parcel of an owner's list: its account, address, and how the map calls it. */
export interface OwnerListParcel {
  id: string;
  address: string | null;
  kind: VacancyKind | null;
  confidence: Confidence | null;
}

/**
 * An owner flag (docs/ETHICS.md): what it means (`text`), why to be careful, and a protective
 * next step. A shard may carry only `id` and `text`; the page then uses its own wording for the
 * other two parts.
 */
export interface OwnerFlag {
  id: string;
  text: string;
  careful: string | null;
  nextStep: string | null;
  links: Link[];
  /** For the many_parcels flag of an organization: its list in tables/owners.json. */
  list?: string | null;
  /**
   * For the many_parcels flag of an owner who may be a person: their other parcels, from this
   * lot's own dossier entry. No citywide file lists people (docs/VERIFICATION.md D3).
   */
  parcels?: OwnerListParcel[] | null;
}

/** The City's list of public property: which agency, its status, and side yard eligibility. */
export interface CityOwned {
  agency: string | null;
  status: string | null;
  sideYardEligible: boolean;
  /** The City's land agencies list it as available (issue #36). */
  available: boolean;
}

export interface Owner {
  names: string[];
  /** The mailing address as the City publishes it, on one line. */
  mailing: string | null;
  type: OwnerType;
  /** Why we gave that owner type, when known. */
  typeReason: string | null;
  flags: OwnerFlag[];
  cityOwned: CityOwned | null;
  /** A notice to show with the flags, such as "deed_fraud". */
  notice: string | null;
  /** Route ids of help for owners and families (the Tangled Title Fund, Fraud Guard). */
  help: string[];
}

/** The parts of a flag that are the same for every parcel, shared by all shards (dossiers/common.json). */
export interface FlagNote {
  careful: string | null;
  nextStep: string | null;
  routes: string[];
  links: Link[];
}

export interface NoticeNote {
  text: string;
  routes: string[];
  links: Link[];
}

export interface DossierNotes {
  flags: Record<string, FlagNote>;
  notices: Record<string, NoticeNote>;
  /** Every zoning overlay by its key (M4.6), from dossiers/common.json. */
  overlays?: Record<string, Overlay>;
}

export interface Transfer {
  /** The date on the deed (else the day the City recorded it), YYYY-MM-DD, or null when none. */
  date: string | null;
  /** The document type as the City records it, such as "DEED" or "DEED SHERIFF". */
  type: string;
  /**
   * The price in dollars, to the cent: the adjusted total (this property's share when one deed
   * covered several), else the total consideration; null when none was recorded.
   */
  price: number | null;
  from: string[];
  to: string[];
  /** Names left out of a long list. */
  fromMore: number;
  toMore: number;
  /** How many properties one deed covered (its price is for all of them). */
  properties: number;
}

export interface Assessment {
  year: number;
  marketValue: number | null;
}

/** The L&I summary of the contract. */
export interface LiSummary {
  openViolations: number | null;
  lastViolation: string | null;
  unsafe: boolean | null;
  imminentlyDangerous: boolean | null;
  /** Every violation since 2016. */
  violations?: number | null;
  unsafeSince?: string | null;
  dangerousSince?: string | null;
  /** The last completed clean and seal, and demolition. */
  sealed?: string | null;
  demolished?: string | null;
}

export interface Nearby {
  /** People shot in the last 12 months and 3 years in the area around the lot. */
  s12: number | null;
  s36: number | null;
  /** People killed in traffic crashes nearby since 2019 (live lookups only). */
  killed: number | null;
  landcare: number | null;
  gardens: number | null;
  /** Hearings still to come within 500 feet, this lot's own left out (M4.6). */
  hearings?: number | null;
}

export interface LandCare {
  program: string | null;
  year: number | null;
}

/** The parts of a dossier whose records the weekly copy holds only for some parcels (docs/CONTRACTS.md section 6). */
export const PARTIAL_PARTS = ['transfers', 'assessments', 'li'] as const;
export type PartialPart = (typeof PARTIAL_PARTS)[number];

/**
 * The parts built from citywide sources (M4.6): known for every parcel when their sources were in
 * the build, named in the dossier's `partial` when they were not. The lot page then says the rule
 * could not be checked, never that it does not apply.
 */
export const RULE_PARTS = ['historic', 'overlays', 'brownfields', 'appeals'] as const;
export type RulePart = (typeof RULE_PARTS)[number];

// The rules and records of each lot (M4.6, issue #42) ---------------------------------------------

/** The board an appeal goes to (pipeline/src/placekeepers/derive/appeals.py, BOARDS). */
export const APPEAL_BOARDS = ['zoning', 'li_review', 'building', 'other'] as const;
export type AppealBoard = (typeof APPEAL_BOARDS)[number];

/**
 * One appeal, as the City publishes it (docs/CONTRACTS.md section 6, `appeals`). Who filed it and
 * the owner the City names are shown on this lot's own page only (docs/ETHICS.md, "Appeals and
 * hearings"). Its free text grounds are never copied: the page links to the City for them.
 */
export interface Appeal {
  board: AppealBoard;
  /** The City's application type, such as "Zoning Board of Adjustment" or "RB_ZBA". */
  application: string | null;
  /** The City's kind of appeal, such as "ZBA Permit Denial - Variance". */
  type: string | null;
  status: string | null;
  decision: string | null;
  /** Days in Philadelphia, YYYY-MM-DD. */
  filed: string | null;
  hearing: string | null;
  /** The hearing's time in Philadelphia, HH:MM, or null when the City gives only the day. */
  hearingTime: string | null;
  decided: string | null;
  /** The registered community organization the City told. */
  rco: string | null;
  appellant: string | null;
  owner: string | null;
}

/** A zoning overlay, as dossiers/common.json describes it by its key. */
export interface Overlay {
  id: string;
  name: string;
  symbol: string | null;
  /** 1 overlay district, 2 supplemental control, 3 Wissahickon Watershed impervious coverage limit, 0 other. */
  type: number;
  section: string | null;
  link: string | null;
  sunset: string | null;
  pendingBill: string | null;
  pendingUrl: string | null;
}

export interface HistoricDistrict {
  name: string;
  date: string | null;
}

/** The lot's entry on the Philadelphia Register of Historic Places. */
export interface RegisterEntry {
  address: string | null;
  /** The day it was listed on its own, when it was. */
  date: string | null;
  /** Listed on its own on a day the City's layer does not give plainly. */
  individual: boolean;
  district: string | null;
  districtDate: string | null;
}

export interface Brownfield {
  id: string;
  name: string | null;
  address: string | null;
  /** Meters from the lot's shape to the EPA's point. */
  meters: number | null;
}

/** The rules for a lot (docs/CONTRACTS.md section 6, `rules`). */
export interface LotRules {
  districts: HistoricDistrict[];
  register: RegisterEntry | null;
  zoning: { code: string; group: string | null; pendingUrl: string | null } | null;
  /** Keys into the overlays of dossiers/common.json. */
  overlays: string[];
  brownfields: Brownfield[];
  /** More brownfield properties within 100 meters than are listed. */
  brownfieldsMore: number;
}

/** One parcel from a dossier shard. A section the shard leaves out is null. */
export interface ShardParcel {
  address: string | null;
  vacancy: Vacancy | null;
  owner: Owner | null;
  transfers: Transfer[] | null;
  assessments: Assessment[] | null;
  li: LiSummary | null;
  /**
   * The parts this dossier was not built from: their records were never downloaded for this
   * parcel, so their absence says nothing (never "No deeds on record.").
   */
  partial: PartialPart[];
  routes: string[];
  suggestions: string[];
  nearby: Nearby | null;
  landcare: LandCare | null;
  garden: boolean;
  /**
   * The lens factors (`f_*`) and floodplain mark (`fp`) the parcel's map tile carries, so a lot
   * page opened from a link, a search or a saved list shows the same score breakdown and flood
   * note as one opened from the map (issue #31). Null for a parcel not on the map.
   */
  lens: Record<string, number> | null;
  /**
   * The displacement watch area the lot lies in (M4.1): its census tract and the area's signs,
   * the same bits as the lot's `dw` on the map. Null outside every watch area.
   */
  displacement: { tract: string; signs: number } | null;
  /** The rules for this lot (M4.6): null when none applies, or when they could not be checked (`missing`). */
  rules: LotRules | null;
  /** Its appeals, newest first (M4.6): empty when it has none, null when not known (`missing`). */
  appeals: Appeal[] | null;
  /** The citywide parts this dossier was built without (M4.6). */
  missing: RulePart[];
}

export interface Shard {
  /** When the pipeline built this shard: the date of the weekly snapshot. */
  generatedAt: string | null;
  parcels: Map<string, ShardParcel>;
  /** Shared flag wording, when the file carries it itself. */
  notes: DossierNotes | null;
}

// Live lookups --------------------------------------------------------------------------------

/** The City's property record (OPA), as a live lookup returns it. */
export interface LiveProperty {
  opa: string;
  address: string | null;
  names: string[];
  mailing: string | null;
  mailingStreet: string | null;
  mailingCityState: string | null;
  mailingZip: string | null;
  /** The City's category, such as "VACANT LAND". */
  category: string | null;
  buildingDescription: string | null;
  saleDate: string | null;
  salePrice: number | null;
  marketValue: number | null;
  /**
   * The owner has a homestead exemption: the City's record that someone lives there, or did. A
   * lot page then never offers conservatorship or shows a possible estate (docs/ETHICS.md).
   */
  homestead: boolean;
  lng: number | null;
  lat: number | null;
}

export const LI_KINDS = ['violation', 'permit', 'demolition', 'unsafe', 'imminently_dangerous', 'clean_seal'] as const;
export type LiKind = (typeof LI_KINDS)[number];

/** One record in the L&I timeline: a violation, permit, demolition, unsafe or imminently dangerous notice, or clean and seal. */
export interface LiEvent {
  kind: LiKind;
  date: string | null;
  title: string | null;
  status: string | null;
  detail: string | null;
  /** Still open: an open violation, or an unsafe or imminently dangerous notice not yet resolved. */
  open: boolean;
}

export interface LiveLi {
  events: LiEvent[];
  /** True when the City had more records than one lookup returns. */
  truncated: boolean;
}

/** A parcel the City's parcel map has at a point. */
export interface ParcelAtPoint {
  opa: string;
  address: string | null;
  shape: Geometry | null;
}

/** The shape of a parcel, for drawing it on the map. */
export interface ParcelShape {
  address: string | null;
  shape: Geometry | null;
}

// The lot timeline's history shards (issue #38) ---------------------------------------------------

/** One parcel of a history shard (dossiers/history/<prefix>.json, docs/CONTRACTS.md section 6). */
export interface HistoryParcel {
  /**
   * The parcel's L&I records grouped by kind (src/dossier/timeline.ts, LiGroups), or null when
   * the weekly copy does not hold them for this parcel (it says so; never "none on record").
   */
  li: LiGroups | null;
  /** The vacancy lists it is on, each with its day, newest first. */
  lists: ListRecord[];
}

export interface HistoryShard {
  generatedAt: string | null;
  /** The parts this build holds for every parcel outside `partial`: "li" when the L&I records are in it. */
  parts: string[];
  parcels: Map<string, HistoryParcel>;
}
