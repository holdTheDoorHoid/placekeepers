// The lot dossier's data, as the web app holds it after reading a shard (docs/CONTRACTS.md, the
// dossier shards) or a live City lookup. Readers turn whatever arrives into these shapes, keeping
// only the fields the contract names, so nothing else can reach the page.

import type { Geometry } from 'geojson';

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
  /** For the many_parcels flag: the owner's list in tables/owners.json. */
  list?: string | null;
}

/** The City's list of public property: which agency, its status, and side yard eligibility. */
export interface CityOwned {
  agency: string | null;
  status: string | null;
  sideYardEligible: boolean;
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
}

export interface Transfer {
  /** YYYY-MM-DD, or null when the record has no date. */
  date: string | null;
  /** The document type as the City records it, such as "DEED" or "DEED SHERIFF". */
  type: string;
  /** The price in whole dollars, or null when none was recorded. */
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
}

export interface LandCare {
  program: string | null;
  year: number | null;
}

/** One parcel from a dossier shard. A section the shard leaves out is null. */
export interface ShardParcel {
  address: string | null;
  vacancy: Vacancy | null;
  owner: Owner | null;
  transfers: Transfer[] | null;
  assessments: Assessment[] | null;
  li: LiSummary | null;
  routes: string[];
  suggestions: string[];
  nearby: Nearby | null;
  landcare: LandCare | null;
  garden: boolean;
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
