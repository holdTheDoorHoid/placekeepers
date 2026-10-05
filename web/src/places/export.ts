// CSV and GeoJSON exports of places: the places in view, or a saved list.
//
// docs/ETHICS.md, "Bulk export": the owner chose not to restrict exports, so they carry what a lot
// page shows about the owner (names and mailing address as the City publishes them, the owner
// type and the owner flags), and their first line points to the terms of use. The flags come from
// the dossier shards (docs/CONTRACTS.md section 6); the GeoJSON keeps each flag's careful note and
// protective next step beside it, and the CSV says where to read them. Nothing here estimates a
// price or ranks how easy a parcel would be to get.
//
// An export holds at most EXPORT_LIMIT places, so it never downloads more than a few dozen shard
// files; the page says so, and exports the places with the highest scores first.

import { permissionFromRoutes, permissionText, type PermissionCode } from '../config/permission.ts';
import type { Manifest } from '../data/manifest.ts';
import { completeFlag, sortFlags } from '../dossier/flags.ts';
import { loadCommon, loadShard, shardLocation } from '../dossier/shard.ts';
import { PUBLIC_OWNER_TYPES, type DossierNotes, type ShardParcel } from '../dossier/types.ts';
import type { Registry } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';
import { formatDate, strings } from '../strings.ts';
import { describePlace, parcelLensOf } from './rank.ts';

/** The most places one export holds. */
export const EXPORT_LIMIT = 500;
/** How many shard files are downloaded at the same time. */
const AT_ONCE = 4;

export interface ExportPlace {
  id: string;
  center: [number, number] | null;
  /** The map's tile properties, when known (places on screen, or saved with a list). */
  properties: Record<string, unknown> | null;
  address?: string | null;
}

export interface ExportFlag {
  id: string;
  title: string;
  text: string;
  careful: string | null;
  next_step: string | null;
}

export interface ExportRow {
  opa_account: string;
  address: string;
  kind: string;
  how_sure: string;
  owner_type: string;
  in_landcare: string;
  lens_score: number | null;
  main_reason: string;
  suggestion: string;
  first_step_to_get_permission: string;
  first_lawful_step: string;
  owner_names: string;
  mailing_address: string;
  owner_flags: ExportFlag[];
  lot_page: string;
  longitude: number | null;
  latitude: number | null;
}

export interface ExportInput {
  places: ExportPlace[];
  registry: Registry;
  state: AppState;
  manifest: Manifest | null;
  dataBase: string;
  /** The site's address, ending in "/", for links to lot pages and the terms of use. */
  siteUrl: string;
  /** What is exported, for the file's notes: "Places in view" or a list's name. */
  title: string;
  now: Date;
  fetchImpl?: typeof fetch;
  /** Called as shard files arrive. */
  onProgress?: (done: number, total: number) => void;
}

export interface ExportResult {
  rows: ExportRow[];
  /** Places left out because the export was full. */
  leftOut: number;
  /** Places whose dossier could not be read (the City's details are missing for them). */
  withoutDetails: number;
  title: string;
  /** The notes at the top of the file: the terms line first. */
  notes: string[];
  generated: string;
}

function mergeNotes(own: DossierNotes | null, common: DossierNotes | null): DossierNotes | null {
  if (!own) return common;
  if (!common) return own;
  return { flags: { ...common.flags, ...own.flags }, notices: { ...common.notices, ...own.notices } };
}

/** Downloads the dossier shards for these places, a few at a time. */
async function loadParcels(input: ExportInput, ids: string[]): Promise<{ parcels: Map<string, ShardParcel>; notes: DossierNotes | null; failed: Set<string> }> {
  const parcels = new Map<string, ShardParcel>();
  const failed = new Set<string>();
  const byPath = new Map<string, string[]>();
  for (const id of ids) {
    const location = shardLocation(id, input.manifest);
    if (location.path) byPath.set(location.path, [...(byPath.get(location.path) ?? []), id]);
    else failed.add(id);
  }
  const paths = [...byPath.keys()];
  const total = paths.length;
  let done = 0;
  let notes: DossierNotes | null = null;
  input.onProgress?.(0, total);
  const next = async (): Promise<void> => {
    const path = paths.shift();
    if (!path) return;
    const result = await loadShard(input.dataBase, path, input.fetchImpl);
    for (const id of byPath.get(path) ?? []) {
      const parcel = result.ok ? result.shard.parcels.get(id) : undefined;
      if (parcel) parcels.set(id, parcel);
      else failed.add(id);
    }
    if (result.ok && result.shard.notes) notes = mergeNotes(notes, result.shard.notes);
    done += 1;
    input.onProgress?.(done, total);
    await next();
  };
  const [common] = await Promise.all([
    loadCommon(input.dataBase, input.manifest?.files ?? null, input.fetchImpl),
    ...Array.from({ length: Math.min(AT_ONCE, total) }, next),
  ]);
  return { parcels, notes: mergeNotes(notes, common ?? null), failed };
}

const KIND = { lot: strings.place.kindLot, building: strings.place.kindBuilding } as Record<string, string>;

function round(n: number | undefined, digits: number): number | null {
  return n === undefined || !Number.isFinite(n) ? null : Number(n.toFixed(digits));
}

/** One place as an export row, from its tile properties and its dossier, whichever are known. */
export function exportRow(input: Pick<ExportInput, 'registry' | 'state' | 'siteUrl'>, place: ExportPlace, parcel: ShardParcel | null, notes: DossierNotes | null): ExportRow {
  const e = strings.export;
  const tile = place.properties;
  const described = tile ? describePlace(input.registry, input.state, { id: place.id, properties: tile, center: place.center ?? [0, 0] }) : null;
  const owner = parcel?.owner ?? null;
  const vacancy = parcel?.vacancy ?? null;

  const kind = described && described.kind ? (described.kind === 1 ? strings.place.kindLot : strings.place.kindBuilding) : vacancy?.kind ? KIND[vacancy.kind]! : '';
  const sure = described && described.confidence ? (strings.place.confidence[described.confidence] ?? '') : vacancy?.confidence ? (strings.dossier.summary.confidence[vacancy.confidence] ?? '') : '';
  const ownerType =
    described?.ownerType !== null && described?.ownerType !== undefined
      ? (strings.ownerTypes[described.ownerType] ?? '')
      : owner
        ? (strings.dossier.ownerType.labels[owner.type] ?? '')
        : '';
  const landcare = described ? described.landcare : parcel ? parcel.landcare !== null : null;
  let permission: PermissionCode | null = described?.permission ?? null;
  if (permission === null && parcel) permission = permissionFromRoutes(parcel.routes, owner ? PUBLIC_OWNER_TYPES.has(owner.type) : false);

  const suggestionIds = described ? described.suggestions.map((s) => s.id) : (parcel?.suggestions ?? []).filter((id) => input.state.suggestions[id] !== false);
  const suggestion = input.registry.suggestions.find((s) => s.id === suggestionIds[0]);
  let firstStep = '';
  if (described?.firstStep) firstStep = `${described.firstStep.route.label}. ${described.firstStep.step}`;
  else if (described?.noRoute) firstStep = strings.permission.noRoute;

  const flags = sortFlags(owner?.flags ?? []).map((flag) => {
    const whole = completeFlag(flag, notes?.flags[flag.id] ?? null);
    return {
      id: whole.id,
      title: strings.dossier.owner.flagTitles[whole.id] ?? strings.dossier.owner.otherFlag,
      text: whole.text,
      careful: whole.careful,
      next_step: whole.nextStep,
    };
  });

  return {
    opa_account: place.id,
    address: parcel?.address ?? place.address ?? '',
    kind,
    how_sure: sure,
    owner_type: ownerType,
    in_landcare: landcare === null ? '' : landcare ? e.yes : e.no,
    lens_score: described?.score ?? null,
    main_reason: described?.why?.main?.label ?? '',
    suggestion: suggestion?.label ?? '',
    first_step_to_get_permission: permission === null ? '' : permissionText(permission),
    first_lawful_step: firstStep,
    owner_names: owner?.names.join('; ') ?? '',
    mailing_address: owner?.mailing ?? '',
    owner_flags: flags,
    lot_page: `${input.siteUrl}#p=${place.id}`,
    longitude: round(place.center?.[0], 6),
    latitude: round(place.center?.[1], 6),
  };
}

/** Gathers what an export holds: downloads the dossiers and builds one row per place. */
export async function gatherExport(input: ExportInput): Promise<ExportResult> {
  const places = input.places.slice(0, EXPORT_LIMIT);
  const { parcels, notes, failed } = await loadParcels(input, places.map((p) => p.id));
  const rows = places.map((place) => exportRow(input, place, parcels.get(place.id) ?? null, notes));
  const e = strings.export;
  const lens = parcelLensOf(input.registry);
  const dataDate = formatDate(input.manifest?.generated_at);
  const weights = lens
    ? lens.factors.map((f) => `${f.label} ${input.state.weights[lens.id]?.[f.id] ?? f.default_weight}`).join(', ')
    : '';
  const notesLines = [
    e.termsLine(`${input.siteUrl}terms/`),
    e.madeLine(rows.length, input.title, formatDate(input.now.toISOString()) ?? '', dataDate),
    e.ownerLine,
    ...(lens ? [e.scoreLine(lens.label, weights)] : []),
  ];
  return {
    rows,
    leftOut: Math.max(0, input.places.length - places.length),
    withoutDetails: places.filter((p) => failed.has(p.id)).length,
    title: input.title,
    notes: notesLines,
    generated: input.now.toISOString(),
  };
}

// Writing the files ---------------------------------------------------------------------------

/** The CSV columns, in order. Their names are stable, so a saved file can be read back. */
export const CSV_COLUMNS = [
  'opa_account',
  'address',
  'kind',
  'how_sure',
  'owner_type',
  'in_landcare',
  'lens_score',
  'main_reason',
  'suggestion',
  'first_step_to_get_permission',
  'first_lawful_step',
  'owner_names',
  'mailing_address',
  'owner_flags',
  'lot_page',
  'longitude',
  'latitude',
] as const satisfies readonly (keyof ExportRow)[];

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (starting with =, +, -, @ or a tab)
 * gets a leading apostrophe, so a name in City records can never run in someone's spreadsheet.
 */
export function csvCell(value: string | number | null, text = true): string {
  if (value === null) return '';
  let out = String(value);
  if (text && /^[=+\-@\t\r]/.test(out)) out = `'${out}`;
  return /[",\r\n]/.test(out) || /^\s|\s$/.test(out) ? `"${out.replace(/"/g, '""')}"` : out;
}

function flagsText(flags: ExportFlag[]): string {
  return flags.map((f) => `${f.title}: ${f.text}`).join(' | ');
}

/** The CSV file: the notes (terms first) as lines starting with "#", then a header and the rows. */
export function toCsv(result: ExportResult): string {
  const lines = result.notes.map((note) => csvCell(`# ${note}`));
  lines.push(CSV_COLUMNS.join(','));
  for (const row of result.rows) {
    lines.push(
      CSV_COLUMNS.map((column) => {
        if (column === 'owner_flags') return csvCell(flagsText(row.owner_flags));
        const value = row[column];
        return csvCell(value, typeof value !== 'number');
      }).join(','),
    );
  }
  // A byte order mark, so spreadsheet programs read the text as UTF-8.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** The GeoJSON file, with the terms of use as its first line. */
export function toGeoJson(result: ExportResult): string {
  const features = result.rows.map(({ longitude, latitude, ...properties }) => ({
    type: 'Feature',
    geometry: longitude !== null && latitude !== null ? { type: 'Point', coordinates: [longitude, latitude] } : null,
    properties,
  }));
  const [terms, ...notes] = result.notes;
  const body = JSON.stringify({ type: 'FeatureCollection', name: result.title, generated: result.generated, notes, features }, null, 1);
  return `{"terms_of_use": ${JSON.stringify(terms)},\n${body.slice(2)}\n`;
}

/** A file name such as "placekeepers-places-in-view-2026-10-04.csv". */
export function exportFileName(title: string, now: Date, extension: 'csv' | 'geojson'): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const day = now.toISOString().slice(0, 10);
  return `placekeepers-${slug || 'places'}-${day}.${extension}`;
}

/** Hands a file to the browser to save. */
export function saveFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
