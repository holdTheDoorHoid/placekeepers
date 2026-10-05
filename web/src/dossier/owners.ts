// Who owns a parcel, worked out in the browser from a live City record, with the same rules the
// pipeline uses for the weekly snapshot (pipeline/src/placekeepers/derive/owners.py, milestone
// M1.3), so a lot page says the same thing whether its data is live or from the snapshot:
//
// * the owner type from the owner names: public bodies first, then company forms, nonprofit
//   words, other company words, then a person's name (two or more words, no digits);
// * a possible estate when a person's name carries estate wording ("EST OF", "HEIRS",
//   "EXECUTRIX"), never for companies, public bodies, "REAL ESTATE" or a life estate;
// * an absentee owner when the mailing address is out of state, elsewhere in Pennsylvania, or
//   elsewhere in Philadelphia, but not at the parcel or on its block, and never when the address
//   cannot be read.
//
// The pipeline also reads the City's list of public property, which a browser lookup does not
// have, so a live lookup keeps the snapshot's owner type whenever the owner names have not changed.
//
// tests/dossier_parity.test.ts checks these rules against the pipeline's answers. On 2026-10-04
// they were also run over every owner name (459,980 pairs) and mailing address (565,546) in OPA's
// records, with the same answers as the pipeline for every one.

import { strings } from '../strings.ts';
import type { OwnerType } from './types.ts';
import { PUBLIC_OWNER_TYPES } from './types.ts';

/** An owner name in one spelling for matching: capitals without accents, only letters, digits, '&' and apostrophes, single spaces. */
export function matchForm(name: string | null | undefined): string {
  const plain = (name ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/&/g, ' & ')
    .replace(/[^A-Z0-9&' ]+/g, ' ');
  return plain.split(/\s+/).filter(Boolean).join(' ');
}

interface PublicPattern {
  type: OwnerType;
  regex: RegExp;
  label: string;
}

const P = (type: OwnerType, pattern: string, label: string): PublicPattern => ({ type, regex: new RegExp(pattern), label });

const PUBLIC_PATTERNS: PublicPattern[] = [
  P('land_bank', String.raw`\bLAND BANK\b`, 'the Philadelphia Land Bank'),
  // Also the misspellings OPA carries ("REDEVEL AUTH OF PHILA", "REDEVLOPMENT AUTHORITY").
  P('redevelopment_authority', String.raw`\bREDEV\w* AUTH|\bPHILA(DELPHIA)? REDEVELOP`, 'the Philadelphia Redevelopment Authority'),
  P('housing_authority', String.raw`\bPHILA(DELPHIA)? HOUSING AUTH`, 'the Philadelphia Housing Authority'),
  P('housing_authority', String.raw`\bHOUSING AUTH`, 'a housing authority'),
  P('other_public', String.raw`\bPHDC\b|\bPHILA(DELPHIA)? HOUSING DEV`, 'the Philadelphia Housing Development Corporation (PHDC)'),
  P('other_public', String.raw`^PHILA(DELPHIA)? HOUSING$`, 'the Philadelphia Housing Authority or PHDC (the name is cut short)'),
  P('city', String.raw`\bCITY OF PHI?LA|\bPHILA(DELPHIA)? CITY OF\b|\bFAIRMOUNT PARK COMM`, 'the City of Philadelphia'),
  P(
    'other_public',
    String.raw`\bSCHOOL DIST(RICT)? OF PHILA|\bPHILA(DELPHIA)? SCHOOL DIST|\bBOARD OF (PUBLIC )?EDUCATION\b`,
    'the School District of Philadelphia',
  ),
  P('other_public', String.raw`\bCOMM(UNITY)? COLLEGE OF PHIL`, 'the Community College of Philadelphia'),
  P('other_public', String.raw`\bSEPTA\b|\bSOUTHEASTERN PENN\w* TRANS`, 'SEPTA'),
  P(
    'other_public',
    String.raw`\bCOMMONWEALTH (OF )?P(ENN\w*|A)\b|\bCOMM OF PENN|\bGENERAL STATE AUTH|\bSTATE OF PENN` + String.raw`|\bPENNDOT\b|\bDEP(AR)?T(MENT)? OF TRANSP`,
    'the Commonwealth of Pennsylvania',
  ),
  P('other_public', String.raw`\bHOUSING FINANCE AGENCY\b|\bPHFA\b`, 'the Pennsylvania Housing Finance Agency'),
  P('other_public', String.raw`\bUNITED STATES OF AMERICA\b|\bUNITED STATES POSTAL|\bU S POSTAL|^U S A$`, 'the United States government'),
  P('other_public', String.raw`\bSEC(RETARY)? OF HOUSING|\bHOUSING (AND|&) URBAN DEV`, 'the U.S. Department of Housing and Urban Development'),
  P('other_public', String.raw`\bVET(ERANS?)? AFF|\bVETERANS ADMIN`, 'the U.S. Department of Veterans Affairs'),
  // OPA writes this one many ways, often cut short: "PHILA AUTH IND DEV", "PHILA AUTH & IND DEV",
  // "PHILADELPHIA AUTHORITY FO".
  P(
    'other_public',
    String.raw`\bAUTH(ORITY)? FOR IND(USTRIAL)? DEV|\bP A I D\b|\bPHILA(DELPHIA)? AUTH(ORITY)?\b`,
    'the Philadelphia Authority for Industrial Development',
  ),
  P('other_public', String.raw`\bPHILA(DELPHIA)? REG\w* POR`, 'the Philadelphia Regional Port Authority'),
  P('other_public', String.raw`\bOFFICE OF THE DISTRICT AT|\bDISTRICT ATTORNEY`, "the Philadelphia District Attorney's Office"),
  P(
    'other_public',
    String.raw`\bPARKING AUTH|\bPORT AUTH|\bREGIONAL PORT\b|\bCONVENTION CENTER AUTH|\bTURNPIKE COMM` +
      String.raw`|\bMUNICIPAL AUTH|\bIND(USTRIAL)? DEV(ELOPMENT)? AUTH|\bSCHOOL (BLDG|BUILDING) AUTH`,
    'a public authority',
  ),
  P('other_public', String.raw`\bGAS WORKS\b`, 'Philadelphia Gas Works'),
];

const FOR_PROFIT = /\b(L ?L ?C|P ?L ?L ?C|L ?L ?L ?P|L ?L ?P|LTD|LIMITED|GP)\b|\b(LP)\b|\b(L P|L ?L)$/;
const NONPROFIT = new RegExp(
  String.raw`\b(CHURCH(ES)?|MINISTR(Y|IES)|CONGREGATION|SYNAGOGUE|MOSQUE|MASJID|ARCHDIOCESE|DIOCESE` +
    String.raw`|PARISH|BAPTIST|METHODIST|EPISCOPAL|LUTHERAN|PRESBYTERIAN|PENTECOSTAL|TABERNACLE` +
    String.raw`|KINGDOM HALL|EVANGELICAL|APOSTOLIC|CATHOLIC|NON ?PROFIT|CHARIT(Y|IES|ABLE)|FOUNDATION` +
    String.raw`|COMMUNITY DEV\w* CORP\w*|CDC|LAND TRUST|NEIGHBORHOOD GARDENS|HABITAT FOR HUMANITY|YMCA` +
    String.raw`|YWCA|UNIVERSITY(?! CITY)|HOSPITAL|HORTICULTURAL SOCIETY|CIVIC ASS\w*|COMMUNITY ASS\w*` +
    String.raw`|NEIGHBORHOOD ASS\w*|TOWN WATCH|AMERICAN LEGION` +
    // Schools, including charter schools whose names OPA cut short ("ILADELPHIA CHARTER SCHOOL",
    // "FRANKLIN TOWNE CHARTER HI"); a "SCHOOL HOUSE" in an address is not a school.
    String.raw`|SCHOOLS?(?! ?HOUSE)|CHARTER (SCH\w*|SC|HI\w*|ACADEM\w*)|CHARTER$|ACADEMY|ACADEMIES|COLLEGE` +
    String.raw`|SEMINARY|MONTESSORI|PREPARATORY)\b`,
);
const COMPANY = new RegExp(
  String.raw`\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|COMPANIES|PARTNERS|PARTNERSHIP` +
    String.raw`|ASSOCIATES|ASSOC|ASSN|ASSOCIATION|HOLDINGS?|PROPERT\w*|REALTY|REAL EST(ATE)?|INVEST\w*` +
    String.raw`|ENTERPRISES?|GROUP|DEVELOPMENT|DEVELOPERS?|MANAGEMENT|MGMT|VENTURES?|CAPITAL|FUNDS?` +
    String.raw`|FUNDING|BANK|MORTGAGE|FINANCIAL|SAVINGS|TRUSTS?|TRUSTEES?|TRST|TRS|TR|T U W|FBO` +
    String.raw`|CUSTODIAN|HOMES|BUILDERS?|CONSTRUCTION|CONTRACTORS?|SERVICES|SOLUTIONS|CONDOMINIUMS?` +
    String.raw`|ESTATES|APARTMENTS|HOUSING|DBA|RENTALS?|HOMEOWNERS|CAMA ?PLAN|RAILROAD|RAILWAY|CONRAIL` +
    String.raw`|AMTRAK|BNY|MELLON)\b|\b(FB|N A)$`,
);
const UNKNOWN_NAME = /\bUNKNOWN\b|\bNOT AVAILABLE\b|\bNONE\b/;
/** Generational suffixes and shares of ownership are part of a person's name: 2ND, 03RD, "1/2 INT". */
const GENERATION = /\b0?\d(ST|ND|RD|TH)\b|\b\d+ \d+ INT(EREST)?\b/g;
const ESTATE_IGNORE = /\b(LIFE|LF) (EST(ATE)?|TENANT)\b|\bREAL EST(ATE)?\b/g;
const ESTATE = new RegExp(
  String.raw`\bEST(ATE)?\b|\bHEIRS?\b|\bDECEASED\b|\bDEC'?D\b|\bEXECUT(OR|ORS|RIX|RICES)\b|\bEXRX?\b` +
    String.raw`|\bEXRS\b|\bADMINISTRAT(OR|ORS|RIX)\b|\bADM(R|RX|X)\b|\bPERSONAL REP\w*|\bPERS REP\b`,
);
/**
 * An owner_1 ending like this continues in owner_2 ("THE TRUSTEES OF THE", "EST OF STEPHEN
 * GIRARD"), except a person's estate written OPA's way, name first: "ESPADA MILAGROS ESTATE OF" is
 * a whole name even when a bank or a trust follows it in owner_2.
 */
const DANGLING = /\b(OF|THE|AND|&|FOR|FBO|TO)$/;
const ESTATE_OF_END = /^(.+) (EST|ESTATE) OF$/;

/** "SMITH JOHN ESTATE OF": a person's estate, written name first, complete on its own. */
function estateOfWhole(unit: string): boolean {
  const found = ESTATE_OF_END.exec(unit);
  return !!found && !['THE', 'AND', '&'].includes(found[1]!);
}

/** Abbreviations explained when an owner name is typed by one of them. */
const MARKER_NOTES: Record<string, string> = strings.dossier.ownerType.markers;

export interface OwnerTypeResult {
  type: OwnerType;
  reason: string;
}

function firstGroup(match: RegExpExecArray): string {
  return match.slice(1).find((g) => g) ?? match[0];
}

function markerReason(marker: string): string {
  return strings.dossier.ownerType.markerReason(MARKER_NOTES[marker] ?? marker);
}

/** Owner names as separate names, joining an owner_1 that runs on into owner_2. */
export function nameUnits(names: string[]): string[] {
  const units: string[] = [];
  for (const name of names) {
    const form = matchForm(name);
    if (!form) continue;
    const last = units.length - 1;
    if (last >= 0 && DANGLING.test(units[last]!) && !estateOfWhole(units[last]!)) units[last] = `${units[last]} ${form}`;
    else units.push(form);
  }
  return units;
}

/** The owner type from the owner names alone. */
export function ownerTypeFromNames(names: string[]): OwnerTypeResult {
  const r = strings.dossier.ownerType;
  const joined = matchForm(names.filter(Boolean).join(' '));
  if (!joined) return { type: 'unknown', reason: r.noName };
  for (const pattern of PUBLIC_PATTERNS) {
    if (pattern.regex.test(joined)) return { type: pattern.type, reason: r.publicName(pattern.label) };
  }
  let found = FOR_PROFIT.exec(joined);
  if (found) return { type: 'company', reason: markerReason(firstGroup(found).replace(/ /g, '')) };
  found = NONPROFIT.exec(joined);
  if (found) return { type: 'nonprofit', reason: markerReason(firstGroup(found)) };
  found = COMPANY.exec(joined);
  if (found) return { type: 'company', reason: markerReason(firstGroup(found)) };
  if (nameUnits(names).some((unit) => /\bN A$/.test(unit))) return { type: 'company', reason: markerReason('N A') };
  const plain = joined.replace(GENERATION, ' ');
  const words = plain.split(' ').filter((w) => w && w !== '&' && w !== 'AND');
  if (UNKNOWN_NAME.test(joined) || /\d/.test(plain) || words.length < 2) return { type: 'unknown', reason: r.unclear };
  return { type: 'individual', reason: r.individual };
}

function isOrganization(unit: string): boolean {
  return PUBLIC_PATTERNS.some((p) => p.regex.test(unit)) || FOR_PROFIT.test(unit) || NONPROFIT.test(unit) || COMPANY.test(unit);
}

/** True when an owner name that belongs to a person carries estate wording. */
export function possibleEstate(names: string[]): boolean {
  return nameUnits(names).some((unit) => !isOrganization(unit) && ESTATE.test(unit.replace(ESTATE_IGNORE, ' ')));
}

/** A private owner: a person, a company, a nonprofit, or a name we could not type. */
export function isPrivate(type: OwnerType, hasNames: boolean): boolean {
  return !PUBLIC_OWNER_TYPES.has(type) && (type !== 'unknown' || hasNames);
}

// Mailing addresses ------------------------------------------------------------------------------

const words = (text: string) => new Set(text.split(' '));
const US_STATES = words(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ ' +
    'NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP AA AE AP',
);
const UNIT_WORDS = words('UNIT APT APARTMENT STE SUITE FL FLR FLOOR RM ROOM BLDG BUILDING PH DEPT SPC LOT');
const DIRECTIONS = words('N S E W NORTH SOUTH EAST WEST NE NW SE SW');
const SUFFIXES = words(
  'STREET ST AVENUE AVE AV ROAD RD BOULEVARD BLVD BLV DRIVE DR LANE LN PLACE PL TERRACE TERR TER COURT CT ' +
    'PARKWAY PKWY SQUARE SQ CIRCLE CIR ALLEY ALY HIGHWAY HWY PIKE WAY WALK MALL PLAZA PLZ',
);
const ORDINALS: Record<string, string> = {
  FIRST: '1ST',
  SECOND: '2ND',
  THIRD: '3RD',
  FOURTH: '4TH',
  FIFTH: '5TH',
  SIXTH: '6TH',
  SEVENTH: '7TH',
  EIGHTH: '8TH',
  NINTH: '9TH',
  TENTH: '10TH',
};
const HOUSE = /^\s*(\d+)\s*[A-Z]?(?:\s*-\s*(\d+)\s*[A-Z]?)?\s+(.+)$/;
const PO_BOX = /\b(P\s*O\s*BOX|POST OFFICE BOX|PO BOX|BOX \d+)\b/;

export interface StreetAddress {
  low: number;
  high: number;
  street: string[];
}

/** A street address as house numbers and street words ("1304-08 E PASSYUNK AVE" is 1304 to 1308 on PASSYUNK), or null without a house number. */
export function parseAddress(text: string | null | undefined): StreetAddress | null {
  const found = HOUSE.exec((text ?? '').toUpperCase());
  if (!found) return null;
  const low = Number(found[1]);
  let high = low;
  if (found[2]) {
    const lowText = String(low);
    const widened = Number(lowText.slice(0, Math.max(0, lowText.length - found[2].length)) + found[2]);
    high = widened >= low ? widened : low;
  }
  let street: string[] = [];
  for (const raw of found[3]!.split(/\s+/)) {
    if (raw.startsWith('#')) break;
    let word = raw.replace(/[^A-Z0-9]/g, '');
    if (!word) continue;
    if (UNIT_WORDS.has(word)) break;
    word = ORDINALS[word] ?? word;
    word = word.replace(/^0+(\d)/, '$1');
    street.push(word);
  }
  const withoutDirections = street.filter((w) => !DIRECTIONS.has(w));
  if (withoutDirections.length) street = withoutDirections;
  if (street.length > 1 && SUFFIXES.has(street[street.length - 1]!)) street = street.slice(0, -1);
  return street.length ? { low, high, street } : null;
}

export type AddressMatch = 'same' | 'same_block' | 'different' | 'po_box' | 'unknown';

export function compareAddresses(parcel: string | null, mailing: string | null): AddressMatch {
  if (mailing && PO_BOX.test(mailing.toUpperCase())) return 'po_box';
  const a = parseAddress(parcel);
  const b = parseAddress(mailing);
  if (!a || !b) return 'unknown';
  // "MC CLELLAN" and "MCCLELLAN" are one street.
  if (a.street.join('') !== b.street.join('')) return 'different';
  if ((a.low <= b.low && b.low <= a.high) || (b.low <= a.low && a.low <= b.high)) return 'same';
  const hundred = Math.floor(b.low / 100);
  if (hundred === Math.floor(a.low / 100) || hundred === Math.floor(a.high / 100)) return 'same_block';
  return 'different';
}

export type AbsenteeScope = 'elsewhere_in_city' | 'po_box_in_city' | 'outside_city' | 'out_of_state';

export interface Absentee {
  scope: AbsenteeScope;
  city: string | null;
  state: string | null;
}

/** ["BLUE BELL", "PA"] from "BLUE BELL PA"; the state is null when the last word is not a US state or territory. */
export function splitCityState(text: string | null | undefined): [string | null, string | null] {
  const parts = (text ?? '').toUpperCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (!parts.length) return [null, null];
  const last = parts[parts.length - 1]!;
  if (US_STATES.has(last)) return [parts.slice(0, -1).join(' ') || null, last];
  return [parts.join(' '), null];
}

/** Whether the owner gets mail somewhere other than the parcel, and where; null at the parcel, on its block, or when unreadable. */
export function absentee(
  location: string | null,
  mailingStreet: string | null,
  mailingCityState: string | null,
  mailingZip: string | null,
): Absentee | null {
  const [city, state] = splitCityState(mailingCityState);
  const zip5 = (mailingZip ?? '').replace(/\D/g, '').slice(0, 5);
  if (!city && !state && !zip5) return null;
  if (state !== null && state !== 'PA') return { scope: 'out_of_state', city, state };
  // Every 191xx ZIP code is Philadelphia, whatever neighborhood the city line names.
  if ((city ?? '').startsWith('PHILA') || zip5.startsWith('191')) {
    const match = compareAddresses(location, mailingStreet);
    if (match === 'po_box') return { scope: 'po_box_in_city', city: 'PHILADELPHIA', state: 'PA' };
    if (match === 'different') return { scope: 'elsewhere_in_city', city: 'PHILADELPHIA', state: 'PA' };
    return null;
  }
  if (state === 'PA') return { scope: 'outside_city', city, state: 'PA' };
  if (city) return { scope: 'out_of_state', city, state: null };
  return { scope: 'outside_city', city: null, state: null };
}

const SMALL_WORDS = new Set(['OF', 'THE', 'AND', 'ON', 'IN', 'AT', 'BY', 'DE', 'LA', 'DEL']);

/** BLUE BELL becomes Blue Bell; KING OF PRUSSIA becomes King of Prussia. */
export function placeName(city: string): string {
  return city
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => (i && SMALL_WORDS.has(word) ? word.toLowerCase() : word.slice(0, 1) + word.slice(1).toLowerCase()))
    .join(' ');
}

/** Two owner lists name the same owners, ignoring spacing, case and punctuation. */
export function sameOwners(a: string[], b: string[]): boolean {
  const key = (names: string[]) => names.map(matchForm).filter(Boolean).join(' / ');
  return key(a) === key(b);
}
