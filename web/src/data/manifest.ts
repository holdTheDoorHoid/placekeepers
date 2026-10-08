// Reads manifest.json from the data root (docs/CONTRACTS.md, section 3) and turns it into
// what the app needs: which file holds each layer, and each source's health in plain words.
//
// The manifest is written by the pipeline, so the reader is forgiving: unknown keys are
// ignored (newer pipelines may add some), wrongly typed values become "unknown" with a
// problem noted, and only a missing or unreadable file, or a schema it cannot read, stops it.

import { parseWatchSummary, type WatchSummary } from '../displacement/watch.ts';
import type { Layer, Registry, Source } from '../registry/types.ts';
import { formatDate, formatNumber, strings } from '../strings.ts';

export const SOURCE_STATUSES = ['ok', 'stale', 'failing', 'missing'] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];
export type DisplayStatus = SourceStatus | 'unknown';

export const MANIFEST_SCHEMA = 1;
export const MANIFEST_FILE = 'manifest.json';

export interface ManifestSource {
  status: DisplayStatus;
  last_attempt: string | null;
  last_success: string | null;
  stale_since: string | null;
  rows: number | null;
  newest_record: string | null;
  message: string | null;
}

export interface ManifestLayer {
  file: string;
  source_layer: string | null;
  sources: string[];
}

export interface ManifestFile {
  bytes: number | null;
  sha256: string | null;
}

/**
 * Which lot dossier shards exist (docs/CONTRACTS.md sections 3 and 6). The shards are not listed
 * one by one in `files`; this says which prefixes have a file, so the site can tell whether a
 * parcel has a published dossier before asking for one.
 */
export interface ManifestDossiers {
  /** How many leading digits of the OPA account name a shard file (4: dossiers/3710.json). */
  prefix_digits: number;
  /** Prefixes that have a file. */
  prefixes: Set<string>;
  files: number | null;
  bytes: number | null;
}

export interface Manifest {
  schema: number;
  build_id: string;
  generated_at: string | null;
  sources: Record<string, ManifestSource>;
  layers: Record<string, ManifestLayer>;
  /** Exactly the files present under the data root (manifest.json and the dossier shards aside). */
  files: Record<string, ManifestFile>;
  /** Plain sentences about the build, possibly none. */
  notes: string[];
  /** The lot dossier shards, or null when none were written (missing in manifests older than them). */
  dossiers?: ManifestDossiers | null;
  /**
   * The displacement watch's periods, the city's own measures and the thresholds (M4.1,
   * docs/CONTRACTS.md section 3), or null when the watch was not measured.
   */
  displacement?: WatchSummary | null;
}

export interface ParseResult {
  manifest: Manifest | null;
  /** Things that were wrong but did not stop the manifest from being used. */
  problems: string[];
  /** Set when the manifest cannot be used at all. */
  error: string | null;
}

const SAFE_PATH = /^(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]+$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(obj: Record<string, unknown>, key: string, where: string, problems: string[]): string | null {
  const v = obj[key];
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v;
  problems.push(`${where}.${key} should be text`);
  return null;
}

function count(obj: Record<string, unknown>, key: string, where: string, problems: string[]): number | null {
  const v = obj[key];
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  problems.push(`${where}.${key} should be a number`);
  return null;
}

/** The `dossiers` block: null when missing (older manifests) or null; problems noted when malformed. */
function parseDossiers(raw: unknown, problems: string[]): ManifestDossiers | null {
  if (raw === undefined || raw === null) return null;
  if (!isObject(raw)) {
    problems.push('dossiers should be an object or null');
    return null;
  }
  const digits = raw.prefix_digits;
  if (typeof digits !== 'number' || !Number.isInteger(digits) || digits < 1 || digits > 9) {
    problems.push('dossiers.prefix_digits should be a whole number from 1 to 9');
    return null;
  }
  const pattern = new RegExp(`^\\d{${digits}}$`);
  const prefixes = new Set<string>();
  if (!Array.isArray(raw.prefixes)) problems.push('dossiers.prefixes should be a list');
  for (const prefix of Array.isArray(raw.prefixes) ? raw.prefixes : []) {
    if (typeof prefix === 'string' && pattern.test(prefix)) prefixes.add(prefix);
    else problems.push(`dossiers.prefixes has "${String(prefix)}", which is not ${digits} digits`);
  }
  return { prefix_digits: digits, prefixes, files: count(raw, 'files', 'dossiers', problems), bytes: count(raw, 'bytes', 'dossiers', problems) };
}

export function parseManifest(json: unknown): ParseResult {
  const problems: string[] = [];
  if (!isObject(json)) return { manifest: null, problems, error: 'manifest.json is not a JSON object' };
  if (json.schema !== MANIFEST_SCHEMA) {
    return { manifest: null, problems, error: `manifest.json has schema ${String(json.schema)}, this site reads schema ${MANIFEST_SCHEMA}` };
  }
  const buildId = typeof json.build_id === 'string' ? json.build_id : '';
  if (!buildId) problems.push('build_id is missing');

  const sources: Record<string, ManifestSource> = {};
  if (json.sources !== undefined && !isObject(json.sources)) problems.push('sources should be an object');
  for (const [id, raw] of Object.entries(isObject(json.sources) ? json.sources : {})) {
    const where = `sources.${id}`;
    if (!isObject(raw)) {
      problems.push(`${where} should be an object`);
      continue;
    }
    let status: DisplayStatus = 'unknown';
    if (typeof raw.status === 'string' && (SOURCE_STATUSES as readonly string[]).includes(raw.status)) {
      status = raw.status as SourceStatus;
    } else {
      problems.push(`${where}.status "${String(raw.status)}" is not one of ${SOURCE_STATUSES.join(', ')}`);
    }
    sources[id] = {
      status,
      last_attempt: text(raw, 'last_attempt', where, problems),
      last_success: text(raw, 'last_success', where, problems),
      stale_since: text(raw, 'stale_since', where, problems),
      rows: count(raw, 'rows', where, problems),
      newest_record: text(raw, 'newest_record', where, problems),
      message: text(raw, 'message', where, problems),
    };
  }

  const layers: Record<string, ManifestLayer> = {};
  if (json.layers !== undefined && !isObject(json.layers)) problems.push('layers should be an object');
  for (const [id, raw] of Object.entries(isObject(json.layers) ? json.layers : {})) {
    const where = `layers.${id}`;
    if (!isObject(raw) || typeof raw.file !== 'string' || !SAFE_PATH.test(raw.file)) {
      problems.push(`${where} needs a file path inside the data root`);
      continue;
    }
    layers[id] = {
      file: raw.file,
      source_layer: typeof raw.source_layer === 'string' ? raw.source_layer : null,
      sources: Array.isArray(raw.sources) ? raw.sources.filter((s): s is string => typeof s === 'string') : [],
    };
  }

  const files: Record<string, ManifestFile> = {};
  if (json.files !== undefined && !isObject(json.files)) problems.push('files should be an object');
  for (const [path, raw] of Object.entries(isObject(json.files) ? json.files : {})) {
    const entry = isObject(raw) ? raw : {};
    files[path] = { bytes: count(entry, 'bytes', `files.${path}`, problems), sha256: text(entry, 'sha256', `files.${path}`, problems) };
  }

  const notes: string[] = [];
  if (json.notes !== undefined && json.notes !== null && !Array.isArray(json.notes)) problems.push('notes should be a list');
  for (const note of Array.isArray(json.notes) ? json.notes : []) {
    if (typeof note === 'string' && note.trim() !== '') notes.push(note);
    else problems.push('notes should hold only sentences');
  }

  return {
    manifest: {
      schema: MANIFEST_SCHEMA,
      build_id: buildId,
      generated_at: typeof json.generated_at === 'string' ? json.generated_at : null,
      sources,
      layers,
      files,
      notes,
      dossiers: parseDossiers(json.dossiers, problems),
      displacement: parseWatchSummary(json.displacement),
    },
    problems,
    error: null,
  };
}

/** Downloads and parses manifest.json from the data root. Never throws. */
export async function loadManifest(dataBase: string, fetchImpl: typeof fetch = fetch): Promise<ParseResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${dataBase}${MANIFEST_FILE}`, { cache: 'no-cache' });
  } catch {
    return { manifest: null, problems: [], error: 'manifest.json could not be downloaded' };
  }
  if (!response.ok) return { manifest: null, problems: [], error: `manifest.json answered ${response.status}` };
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { manifest: null, problems: [], error: 'manifest.json is not valid JSON' };
  }
  return parseManifest(json);
}

/** True for the committed test data, so the site can say it is not showing real places. */
export function isSampleData(manifest: Manifest | null): boolean {
  return !!manifest && manifest.build_id.startsWith('fixture');
}

// Layer files ------------------------------------------------------------------------------

export type DataKind = 'pmtiles' | 'geojson';

export interface LayerData {
  kind: DataKind;
  /** Path under the data root, as in the manifest. */
  path: string;
  /** Full address of the file. */
  url: string;
  /** Layer name inside a tile file; GeoJSON files hold one layer and have none. */
  sourceLayer: string | null;
}

export type LayerDataResult =
  | { ok: true; data: LayerData }
  | { ok: false; reason: 'no_manifest' | 'not_published' | 'unsupported'; path: string };

export function dataKind(path: string): DataKind | null {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pmtiles')) return 'pmtiles';
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) return 'geojson';
  return null;
}

/**
 * Where the pipeline writes a layer as GeoJSON when it cannot build tiles: beside the tile
 * file, named <tile file stem>.<source layer>.geojson (docs/CONTRACTS.md, section 3).
 */
export function geojsonFallbackPath(tileFile: string, sourceLayer: string): string {
  return tileFile.replace(/\.pmtiles$/i, `.${sourceLayer}.geojson`);
}

/**
 * Where a layer's features live. A layer is available only when the manifest's `files`
 * lists its file. The manifest's own entry for the layer wins over the registry. If the
 * tile file is missing but its GeoJSON fallback is listed, the GeoJSON is used. A
 * ".geojson" path loads as GeoJSON, a ".pmtiles" path as vector tiles.
 */
export function resolveLayerData(layer: Layer, manifest: Manifest | null, dataBase: string): LayerDataResult {
  const published = manifest?.layers[layer.id];
  const file = published?.file ?? layer.file;
  if (!manifest) return { ok: false, reason: 'no_manifest', path: file };

  const candidates: { path: string; sourceLayer: string }[] = [];
  const add = (path: string, sourceLayer: string) => {
    candidates.push({ path, sourceLayer });
    if (/\.pmtiles$/i.test(path)) candidates.push({ path: geojsonFallbackPath(path, sourceLayer), sourceLayer });
  };
  add(file, published?.source_layer ?? layer.source_layer);
  if (layer.file !== file) add(layer.file, layer.source_layer);

  const found = candidates.find((c) => c.path in manifest.files);
  if (!found) return { ok: false, reason: 'not_published', path: file };
  const kind = dataKind(found.path);
  if (!kind) return { ok: false, reason: 'unsupported', path: found.path };
  return {
    ok: true,
    data: {
      kind,
      path: found.path,
      url: `${dataBase}${found.path}`,
      sourceLayer: kind === 'pmtiles' ? found.sourceLayer : null,
    },
  };
}

// Data root --------------------------------------------------------------------------------

/**
 * Turns the configured data root into a full address ending in "/". Absolute addresses are
 * kept (for example a Cloudflare R2 bucket); relative ones resolve against the site base,
 * so "./data/" works from every page of the site.
 */
export function resolveDataBase(configured: string | undefined, siteBase: string, pageUrl: string): string {
  const value = configured && configured.trim() !== '' ? configured.trim() : './data/';
  const root = new URL(siteBase, pageUrl);
  const resolved = new URL(value, root).href;
  return resolved.endsWith('/') ? resolved : `${resolved}/`;
}

// The base map ------------------------------------------------------------------------------

/** The base map's folder under the data root: made by the site, never by the pipeline. */
export const BASEMAP_DIR = 'basemap/';

/**
 * Sources behind the base map alone. The pipeline never fetches them (the manifest calls them
 * missing), so the site judges them by the base map file itself.
 */
export function baseMapSources(reg: Registry): Set<string> {
  const base = new Set<string>();
  const other = new Set<string>();
  for (const layer of reg.layers) {
    for (const id of layer.sources) (layer.file.startsWith(BASEMAP_DIR) ? base : other).add(id);
  }
  return new Set([...base].filter((id) => !other.has(id)));
}

export interface BaseMapInfo {
  available: boolean;
  /** The day the base map was made from OpenStreetMap, as YYYY-MM-DD, when known. */
  built: string | null;
}

/** Reads basemap/BUILD (the Protomaps build date, such as 20261004) beside the base map. Never throws. */
export async function loadBaseMapInfo(dataBase: string, fetchImpl: typeof fetch = fetch): Promise<BaseMapInfo> {
  try {
    const response = await fetchImpl(`${dataBase}${BASEMAP_DIR}BUILD`, { cache: 'no-cache' });
    if (!response.ok) return { available: false, built: null };
    const match = /^(\d{4})(\d{2})(\d{2})\s*$/.exec(await response.text());
    return { available: true, built: match ? `${match[1]}-${match[2]}-${match[3]}` : null };
  } catch {
    return { available: false, built: null };
  }
}

// Status in plain words --------------------------------------------------------------------

export interface StatusRow {
  id: string;
  /** The registry entry, or null for a source the manifest knows but the registry does not. */
  source: Source | null;
  name: string;
  status: DisplayStatus;
  entry: ManifestSource | null;
  /** For the base map's source: what the base map file says, in place of the manifest. */
  basemap?: BaseMapInfo;
}

/**
 * One row per registry source (in registry order), then any extra sources in the manifest. The
 * base map's source is judged by `basemap` (its file), not by the manifest; without that
 * information it is left out.
 */
export function statusRows(reg: Registry, manifest: Manifest | null, basemap?: BaseMapInfo): StatusRow[] {
  const base = baseMapSources(reg);
  const rows: StatusRow[] = reg.sources.flatMap((source): StatusRow[] => {
    if (base.has(source.id)) {
      if (!basemap) return [];
      return [{ id: source.id, source, name: source.name, status: basemap.available ? 'ok' : 'failing', entry: null, basemap }];
    }
    const entry = manifest?.sources[source.id] ?? null;
    return [{ id: source.id, source, name: source.name, status: entry?.status ?? 'missing', entry }];
  });
  for (const [id, entry] of Object.entries(manifest?.sources ?? {})) {
    if (!reg.sources.some((s) => s.id === id)) rows.push({ id, source: null, name: id, status: entry.status, entry });
  }
  return rows;
}

export interface StatusText {
  label: string;
  /** One sentence saying what the status means for the map. */
  summary: string | null;
  details: string[];
}

export function describeStatus(row: StatusRow): StatusText {
  const s = strings.status;
  if (row.basemap) {
    const built = formatDate(row.basemap.built);
    const summary = !row.basemap.available ? s.basemapMissing : built ? s.basemapMade(built) : s.basemapNoDate;
    return { label: s.basemapLabel[row.status] ?? s.statusLabel[row.status], summary, details: [] };
  }
  const e = row.entry;
  let summary: string | null = null;
  if (row.status === 'stale') {
    const since = formatDate(e?.stale_since);
    summary = since ? s.staleSince(since) : s.staleNoDate;
  } else if (row.status === 'failing') summary = s.failingText;
  else if (row.status === 'missing') summary = s.missingText;
  else if (row.status === 'unknown') summary = s.unknownText;

  const details: string[] = [];
  if (e) {
    const success = formatDate(e.last_success);
    if (success) details.push(s.lastSuccess(success));
    else if (row.status !== 'missing') details.push(s.neverSucceeded);
    const attempt = formatDate(e.last_attempt);
    if (attempt && e.last_attempt !== e.last_success) details.push(s.lastAttempt(attempt));
    if (e.rows !== null) details.push(s.rows(e.rows));
    const newest = formatDate(e.newest_record);
    if (newest) details.push(s.newest(newest));
    if (e.message) details.push(s.message(e.message));
  }
  return { label: s.statusLabel[row.status], summary, details };
}

export type Freshness =
  | { kind: 'ok'; text: string }
  | { kind: 'stale' | 'failing' | 'unknown'; text: string };

/** The short badge in the header: the date of the data, or a warning that links to the status page. */
export function freshness(reg: Registry, manifest: Manifest | null): Freshness {
  if (!manifest) return { kind: 'unknown', text: strings.freshness.unknown };
  const rows = statusRows(reg, manifest).filter((r) => r.source);
  if (rows.some((r) => r.status === 'failing' || r.status === 'missing' || r.status === 'unknown')) {
    return { kind: 'failing', text: strings.freshness.failing };
  }
  if (rows.some((r) => r.status === 'stale')) return { kind: 'stale', text: strings.freshness.stale };
  const date = formatDate(manifest.generated_at, 'short');
  return date ? { kind: 'ok', text: strings.freshness.ok(date) } : { kind: 'unknown', text: strings.freshness.unknown };
}

export function statusSummary(rows: StatusRow[]): string {
  const n = (status: DisplayStatus) => rows.filter((r) => r.status === status).length;
  const stale = n('stale');
  const failing = n('failing') + n('unknown');
  const missing = n('missing');
  return stale + failing + missing === 0 ? strings.status.summaryAllOk : strings.status.summary(stale, failing, missing);
}

export { formatNumber };
