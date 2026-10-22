// Projects neighbors finished (M5.3, issue #47): the table the pipeline publishes
// (tables/projects.json, docs/CONTRACTS.md section 2), the map layer's features (`projects` in
// tiles/projects.pmtiles, section 4), and what a lot page or a tap shows about each one.
//
// Every project was approved by the owner before the pipeline published it. Nothing here asks
// GitHub for anything: the link to a report is a plain link the visitor may follow, and the map
// loads no photo (docs/ETHICS.md, "Privacy"). Links are kept only when they are https.

import type { Manifest } from '../data/manifest.ts';
import { formatDate, strings } from '../strings.ts';

export const PROJECTS_TABLE = 'tables/projects.json';
export const PROJECTS_SCHEMA = 1;

/** Each kind and its number in the tiles (`k`); numbers never change meaning. */
export const PROJECT_KIND_CODES = {
  other: 0,
  cleanup: 1,
  garden: 2,
  seating: 3,
  art: 4,
  trees: 5,
  city_install: 6,
  fix_311: 7,
} as const;
export type ProjectKind = keyof typeof PROJECT_KIND_CODES;
export const PROJECT_KINDS = Object.keys(PROJECT_KIND_CODES) as ProjectKind[];

export function isProjectKind(v: unknown): v is ProjectKind {
  return typeof v === 'string' && v in PROJECT_KIND_CODES;
}

export function kindOfCode(code: unknown): ProjectKind {
  const n = typeof code === 'number' ? code : typeof code === 'string' ? Number(code) : NaN;
  return PROJECT_KINDS.find((k) => PROJECT_KIND_CODES[k] === n) ?? 'other';
}

export interface ProjectRecord {
  id: string;
  /** The GitHub issue it was reported in, or null for a hand entry. */
  issue: number | null;
  kind: ProjectKind;
  /** The month it was finished, YYYY-MM. */
  finished: string;
  /** The day the owner approved the report, YYYY-MM-DD, or null. */
  approved: string | null;
  parcel: string | null;
  address: string | null;
  lng: number;
  lat: number;
  group: string | null;
  note: string | null;
  /** The report on GitHub, or a hand entry's public source; https only. */
  link: string | null;
}

export interface ProjectsTable {
  generatedAt: string | null;
  asOf: string | null;
  projects: ProjectRecord[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

/** A link the page may show: https only (anything else is dropped). */
export function safeLink(v: unknown): string | null {
  const t = text(v);
  if (!t) return null;
  try {
    const url = new URL(t);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** One project from the table, or null when it lacks what the page needs. */
export function parseProject(v: unknown): ProjectRecord | null {
  if (!isObj(v)) return null;
  const id = text(v.id);
  const finished = text(v.finished);
  const lng = typeof v.lng === 'number' && Number.isFinite(v.lng) ? v.lng : null;
  const lat = typeof v.lat === 'number' && Number.isFinite(v.lat) ? v.lat : null;
  if (!id || !finished || !MONTH.test(finished) || lng === null || lat === null) return null;
  const parcel = text(v.parcel);
  return {
    id,
    issue: typeof v.issue === 'number' && Number.isInteger(v.issue) && v.issue > 0 ? v.issue : null,
    kind: isProjectKind(v.kind) ? v.kind : 'other',
    finished,
    approved: typeof v.approved === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.approved) ? v.approved : null,
    parcel: parcel && /^\d{9}$/.test(parcel) ? parcel : null,
    address: text(v.address),
    lng,
    lat,
    group: text(v.group),
    note: text(v.note),
    link: safeLink(v.link),
  };
}

export function parseProjectsTable(json: unknown): ProjectsTable | null {
  if (!isObj(json) || json.schema !== PROJECTS_SCHEMA || !Array.isArray(json.projects)) return null;
  return {
    generatedAt: text(json.generated_at),
    asOf: text(json.as_of),
    projects: json.projects.map(parseProject).filter((p): p is ProjectRecord => p !== null),
  };
}

/** A project from the map layer's short properties (`id`, `k`, `f`, `p`, `a`, `g`, `n`, `l`). */
export function projectFromFeature(props: Record<string, unknown>, lngLat: [number, number] | null = null): ProjectRecord | null {
  const parcel = text(props.p);
  const id = text(props.id);
  const finished = text(props.f);
  if (!id || !finished || !MONTH.test(finished)) return null;
  const issue = /^r(\d+)$/.exec(id);
  return {
    id,
    issue: issue ? Number(issue[1]) : null,
    kind: kindOfCode(props.k),
    finished,
    approved: null,
    parcel: parcel && /^\d{9}$/.test(parcel) ? parcel : null,
    address: text(props.a),
    lng: lngLat?.[0] ?? 0,
    lat: lngLat?.[1] ?? 0,
    group: text(props.g),
    note: text(props.n),
    link: safeLink(props.l),
  };
}

/** The projects on one parcel, newest first. */
export function projectsOn(table: ProjectsTable | null, opa: string): ProjectRecord[] {
  if (!table) return [];
  return table.projects.filter((p) => p.parcel === opa).sort((a, b) => (a.finished < b.finished ? 1 : a.finished > b.finished ? -1 : a.id < b.id ? -1 : 1));
}

/** "May 2026". */
export function monthWords(finished: string): string {
  return formatDate(`${finished}-15`)?.replace(/ \d{1,2},/, '') ?? finished;
}

export interface ProjectView {
  id: string;
  kind: string;
  /** "Finished in May 2026". */
  when: string;
  /** "By Lawrence Street Growers", or null. */
  by: string | null;
  /** Where it is, in words, when the map knows an address. */
  where: string | null;
  note: string | null;
  link: { label: string; url: string } | null;
  /** The lot page to open, when the project is on a parcel. */
  parcel: string | null;
}

export function describeProject(p: ProjectRecord): ProjectView {
  const s = strings.projects;
  return {
    id: p.id,
    kind: s.kinds[p.kind] ?? s.kinds.other!,
    when: s.finished(monthWords(p.finished)),
    by: p.group ? s.by(p.group) : null,
    where: p.address,
    note: p.note,
    link: p.link ? { label: p.issue !== null ? s.report : s.source, url: p.link } : null,
    parcel: p.parcel,
  };
}

/** What the lot page knows about the table: not asked yet, loading, found, or why not. */
export type ProjectsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; table: ProjectsTable }
  | { status: 'unpublished' }
  | { status: 'failed' };

const cache = new Map<string, Promise<ProjectsState>>();

/** Downloads and reads the table once per page visit, when the manifest lists it. */
export function loadProjectsTable(dataBase: string, manifest: Pick<Manifest, 'files'> | null, fetchImpl: typeof fetch = fetch): Promise<ProjectsState> {
  if (!manifest || !(PROJECTS_TABLE in manifest.files)) return Promise.resolve({ status: 'unpublished' });
  const key = `${dataBase}${PROJECTS_TABLE}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async (): Promise<ProjectsState> => {
      try {
        const response = await fetchImpl(key);
        if (response.status === 404) return { status: 'unpublished' };
        if (!response.ok) return { status: 'failed' };
        const table = parseProjectsTable(await response.json());
        return table ? { status: 'found', table } : { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    })();
    cache.set(key, pending);
    // A failed download may work next time.
    pending.then((result) => {
      if (result.status === 'failed') cache.delete(key);
    });
  }
  return pending;
}

/** Forgets the downloaded table (for tests). */
export function clearProjectsCache(): void {
  cache.clear();
}
