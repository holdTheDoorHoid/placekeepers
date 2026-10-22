// Projects neighbors finished (M5.3, issue #47): the table and the map layer as the pipeline
// publishes them, a tapped project, the lot page's "Projects here" with the prefilled report form,
// the project kind in the lot timeline and in print, and privacy: nothing is fetched from GitHub,
// links are https only, and no user name or photo ever appears.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { loadRegistry } from '../plugins/registry.ts';
import Dossier from '../src/components/dossier/Dossier.svelte';
import DossierPrint from '../src/components/dossier/DossierPrint.svelte';
import ProjectDetails from '../src/components/projects/ProjectDetails.svelte';
import { projectReportUrl, REPO_URL, SITE_URL } from '../src/config/links.ts';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier, type DossierInput } from '../src/dossier/build.ts';
import { printModel } from '../src/dossier/print.ts';
import { parseCommon, parseShard } from '../src/dossier/shard.ts';
import { buildTimeline, byYear } from '../src/dossier/timeline.ts';
import { STYLES } from '../src/map/styles/index.ts';
import {
  PROJECT_KIND_CODES,
  clearProjectsCache,
  describeProject,
  loadProjectsTable,
  monthWords,
  parseProjectsTable,
  projectFromFeature,
  projectsOn,
  safeLink,
  type ProjectsState,
} from '../src/projects/projects.ts';
import { defaultState } from '../src/state/defaults.ts';
import { strings } from '../src/strings.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const json = (path: string) => JSON.parse(read(path));
const registry = loadRegistry();
const manifest = parseManifest(json('../fixtures/data/manifest.json')).manifest!;
const shard = parseShard(json('../fixtures/data/dossiers/9900.json')).shard!;
const notes = parseCommon(json('../fixtures/data/dossiers/common.json'));
const TABLE = json('../fixtures/data/tables/projects.json');
const LAYER = json('../fixtures/data/tiles/projects.projects.geojson');
const table = parseProjectsTable(TABLE)!;
const FORM = parse(read('../../.github/ISSUE_TEMPLATE/project.yml'));
const p = strings.projects;

function view(opa: string, projects: ProjectsState, over: Partial<DossierInput> = {}) {
  const parcel = shard.parcels.get(opa)!;
  return buildDossier({
    opa,
    registry,
    state: defaultState(registry, 'analysis'),
    manifest,
    shard: { status: 'found', parcel, generatedAt: shard.generatedAt, notes },
    tile: null,
    live: IDLE_PARTS,
    liveOn: false,
    center: [-75.1557, 39.9851],
    now: new Date('2026-10-04T18:30:00Z'),
    history: { status: 'unpublished' },
    projects,
    ...over,
  });
}

const textOf = (markup: string) =>
  markup
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

describe('the projects table', () => {
  it('reads the sample table, newest first, and the map layer carries the same projects', () => {
    expect(table.projects.map((x) => x.id)).toEqual(['r14', 'r13', 'r12', 'h2025_0001']);
    const ids = LAYER.features.map((f: { properties: { id: string } }) => f.properties.id);
    expect(ids).toEqual(table.projects.map((x) => x.id));
    for (const feature of LAYER.features) {
      const record = table.projects.find((x) => x.id === feature.properties.id)!;
      expect(feature.properties.k).toBe(PROJECT_KIND_CODES[record.kind]);
      expect(feature.properties.f).toBe(record.finished);
    }
  });

  it('keeps only rows it can show, and links that are https', () => {
    const parsed = parseProjectsTable({
      schema: 1,
      projects: [
        { id: 'a', kind: 'garden', finished: '2026-05', lng: -75.1, lat: 39.9, link: 'javascript:alert(1)' },
        { id: 'b', kind: 'spaceship', finished: '2026-05', lng: -75.1, lat: 39.9, link: 'http://example.com' },
        { id: 'c', kind: 'garden', finished: '2026-13', lng: -75.1, lat: 39.9 },
        { id: 'd', kind: 'garden', finished: '2026-05' },
        { id: 'e', kind: 'trees', finished: '2025-01', lng: -75.1, lat: 39.9, parcel: '12345', link: 'https://example.org/x' },
      ],
    })!;
    expect(parsed.projects.map((x) => [x.id, x.kind, x.link, x.parcel])).toEqual([
      ['a', 'garden', null, null],
      ['b', 'other', null, null],
      ['e', 'trees', 'https://example.org/x', null],
    ]);
    expect(parseProjectsTable({ schema: 2, projects: [] })).toBeNull();
    expect(safeLink('https://github.com/holdTheDoorHoid/placekeepers/issues/12')).toBe('https://github.com/holdTheDoorHoid/placekeepers/issues/12');
    expect(safeLink('ftp://example.org')).toBeNull();
  });

  it('lists a lot\'s projects newest first', () => {
    expect(projectsOn(table, '990000005').map((x) => x.id)).toEqual(['r12', 'h2025_0001']);
    expect(projectsOn(table, '990000001')).toEqual([]);
    expect(projectsOn(null, '990000005')).toEqual([]);
  });

  it('downloads the table once, and asks nothing when the manifest does not list it', async () => {
    clearProjectsCache();
    const asked: string[] = [];
    const fetchImpl = (async (url: string) => {
      asked.push(String(url));
      return new Response(JSON.stringify(TABLE));
    }) as unknown as typeof fetch;
    expect(await loadProjectsTable('https://example.org/data/', { files: {} }, fetchImpl)).toEqual({ status: 'unpublished' });
    expect(asked).toEqual([]);
    const first = await loadProjectsTable('https://example.org/data/', manifest, fetchImpl);
    await loadProjectsTable('https://example.org/data/', manifest, fetchImpl);
    expect(first.status).toBe('found');
    expect(asked).toEqual(['https://example.org/data/tables/projects.json']);
    clearProjectsCache();
  });
});

describe('a project in words', () => {
  it('says what was done, when, by which group, what it took, and links to the report', () => {
    const garden = describeProject(table.projects.find((x) => x.id === 'r12')!);
    expect(garden).toMatchObject({
      kind: 'Garden',
      when: 'Finished in May 2026',
      by: 'By Example Avenue Growers',
      parcel: '990000005',
      link: { label: p.report, url: 'https://github.com/holdTheDoorHoid/placekeepers/issues/12' },
    });
    const hand = describeProject(table.projects.find((x) => x.id === 'h2025_0001')!);
    expect(hand.link).toEqual({ label: p.source, url: 'https://example.org/sample-block-club-cleanup' });
    const trees = describeProject(table.projects.find((x) => x.id === 'r13')!);
    expect(trees.by).toBeNull();
    expect(monthWords('2025-09')).toBe('September 2025');
  });

  it('reads the map layer\'s short properties', () => {
    const feature = LAYER.features.find((f: { properties: { id: string } }) => f.properties.id === 'r14');
    const project = projectFromFeature(feature.properties, [-75.15655, 39.98535])!;
    expect(project).toMatchObject({ id: 'r14', issue: 14, kind: 'city_install', parcel: null, group: 'Sample Stop Riders' });
    expect(projectFromFeature({ id: 'x' })).toBeNull();
  });

  it('shows a tapped project with no user name and no picture, and a plain link to GitHub', () => {
    const features = LAYER.features.filter((f: { properties: { p?: string } }) => f.properties.p === '990000005').map((f: { properties: Record<string, unknown> }) => f.properties);
    const html = render(ProjectDetails, { props: { features, lngLat: [-75.1557, 39.9851], onOpenLot: () => {} } }).body;
    const text = textOf(html);
    expect(text).toContain('2 projects here');
    expect(text).toContain('Garden Finished in May 2026 By Example Avenue Growers');
    expect(text).toContain(p.whatItTook);
    expect(text).toContain(p.openLot);
    expect(text).toContain(p.privacy);
    expect(html).toContain('href="https://github.com/holdTheDoorHoid/placekeepers/issues/12" target="_blank" rel="noopener noreferrer"');
    expect(html).not.toMatch(/<img|<picture|<video/);
  });
});

describe('the report form', () => {
  it('opens the issue form prefilled with the lot, using the form\'s own field ids', () => {
    const url = new URL(projectReportUrl('990000005', '1305 N EXAMPLE AVE'));
    expect(`${url.origin}${url.pathname}`).toBe(`${REPO_URL}/issues/new`);
    expect(url.searchParams.get('template')).toBe('project.yml');
    expect(url.searchParams.get('where')).toBe(`${SITE_URL}#p=990000005 (1305 N EXAMPLE AVE)`);
    expect(url.searchParams.get('title')).toBe('Project: 1305 N EXAMPLE AVE');
    const ids = FORM.body.filter((item: { id?: string }) => item.id).map((item: { id: string }) => item.id);
    expect(ids).toContain('where');
    expect(FORM.title).toBe('Project: ');
    // From the How and Contact pages, the form opens empty.
    expect(new URL(projectReportUrl()).searchParams.toString()).toBe('template=project.yml');
  });

  it('asks only what the issue describes, and says photos stay on GitHub', () => {
    const labels = FORM.body.filter((item: { type: string }) => item.type !== 'markdown').map((item: { attributes: { label: string } }) => item.attributes.label);
    expect(labels).toEqual([
      'What was done',
      'Where',
      'Month it was finished',
      'Year it was finished',
      'Was permission given?',
      'Group name to show (optional)',
      'What it took (optional)',
      'Showing it on the map',
    ]);
    const intro = FORM.body[0].attributes.value as string;
    expect(intro).toMatch(/never shows your\s+GitHub user name/);
    expect(intro).toMatch(/face of a child/);
    expect(intro).toMatch(/license plate/);
  });
});

describe('the lot page', () => {
  it('lists the projects here, links each report, and offers the prefilled form', () => {
    const v = view('990000005', { status: 'found', table });
    expect(v.projects.status).toBe('ready');
    expect(v.projects.items.map((x) => x.id)).toEqual(['r12', 'h2025_0001']);
    const html = render(Dossier, { props: { view: v, manifest, showTitle: true, idPrefix: 'test' } }).body;
    const text = textOf(html);
    const headings = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(headings.slice(0, 3)).toEqual(['Summary', 'What you can do', p.section]);
    expect(text).toContain('Garden Finished in May 2026 By Example Avenue Growers');
    expect(text).toContain('Cleanup Finished in September 2025 By Example Block Club');
    expect(text).toContain(p.tellUsHere);
    expect(text).toContain(p.oneLot);
    expect(html).toContain(projectReportUrl('990000005', '1305 N EXAMPLE AVE').replace(/&/g, '&amp;'));
    expect(html).not.toMatch(/<img|<picture|<video/);
  });

  it('says plainly when there are none, when the list is missing, and while it loads', () => {
    expect(textOf(render(Dossier, { props: { view: view('990000001', { status: 'found', table }), manifest } }).body)).toContain(p.none);
    expect(view('990000001', { status: 'unpublished' }).projects.status).toBe('unpublished');
    expect(view('990000001', { status: 'failed' }).projects.status).toBe('failed');
    expect(view('990000001', { status: 'loading' }).projects.status).toBe('loading');
    expect(view('990000001', { status: 'idle' }).projects.status).toBe('loading');
  });

  it('puts each project in the timeline, dated by its month, with a switch of its own', () => {
    const v = view('990000005', { status: 'found', table });
    const kinds = v.history.timeline.kinds.map((k) => [k.id, k.label]);
    expect(kinds).toContainEqual(['project', p.timelineToggle]);
    const rows = v.history.timeline.years.flatMap((y) => y.rows).filter((r) => r.kind === 'project');
    expect(rows.map((r) => [r.day, r.dateLabel, r.label, r.items.map((i) => i.text)])).toEqual([
      ['2026-05', 'May', p.timelineKind, ['Garden, by Example Avenue Growers']],
      ['2025-09', 'Sep', p.timelineKind, ['Cleanup, by Example Block Club']],
    ]);
    const hidden = view('990000005', { status: 'found', table }, { hiddenKinds: ['project'] });
    expect(hidden.history.timeline.years.flatMap((y) => y.rows).some((r) => r.kind === 'project')).toBe(false);
  });

  it('sorts a month only record as the end of its month, and merges projects of one month', () => {
    const built = buildTimeline({
      transfers: [{ date: '2026-05-20', type: 'DEED', price: 1, properties: 1, from: [], fromMore: 0, to: [], toMore: 0 }],
      li: null,
      lists: [],
      landcare: null,
      projects: [
        { finished: '2026-05', text: 'Garden' },
        { finished: '2026-05', text: 'Trees' },
      ],
      today: '2026-10-04',
    });
    expect(built.rows.map((r) => [r.kind, r.day, r.items.length])).toEqual([
      ['project', '2026-05', 2],
      ['deed', '2026-05-20', 1],
    ]);
    expect(byYear(built.rows)[0]!.year).toBe('2026');
    expect(built.rows[0]!.future).toBe(false);
  });

  it('prints the projects here with the address of each report, and in the newest records', () => {
    const v = view('990000005', { status: 'found', table });
    const model = printModel(v, new Date('2026-10-04T18:30:00Z'));
    expect(model.projects).toEqual([
      'Garden. Finished in May 2026. By Example Avenue Growers. https://github.com/holdTheDoorHoid/placekeepers/issues/12',
      'Cleanup. Finished in September 2025. By Example Block Club. https://example.org/sample-block-club-cleanup',
    ]);
    expect(model.history.events).toContainEqual({ date: 'May 2026', kind: p.timelineKind, text: 'Garden, by Example Avenue Growers' });
    const html = render(DossierPrint, { props: { view: v, now: new Date('2026-10-04T18:30:00Z') } }).body;
    expect(textOf(html)).toContain(p.printTitle);
  });
});

describe('the map layer', () => {
  it('draws a badge that opens a project, explained in its legend', () => {
    const layer = registry.layers.find((l) => l.id === 'projects')!;
    expect(layer.style).toBe('projects');
    expect(layer.group).toBe('care');
    expect(STYLES.projects.clickable).toEqual(['badge']);
    const ctx = { layer, registry, state: defaultState(registry, 'analysis'), sourceId: 's', sourceLayer: 'projects' };
    expect(STYLES.projects.layers(ctx).map((l) => l.id)).toEqual(['pk:projects:badge', 'pk:projects:center', 'pk:projects:selected']);
    const legend = STYLES.projects.legend(ctx);
    expect(legend.map((e) => ('label' in e ? e.label : 'text' in e ? e.text : ''))).toEqual([p.legend, p.legendNote, p.privacy]);
    expect(strings.streets.detailsTitle('projects')).toBe(p.detailsTitle);
  });

  it('names its sources and the license reporters agreed to in the registry', () => {
    const reports = registry.sources.find((s) => s.id === 'project_reports')!;
    expect(reports.endpoint).toMatchObject({ kind: 'github_issues', repo: 'holdTheDoorHoid/placekeepers', label: 'project-approved' });
    expect(reports.license).toBe('neighbor_reports_odbl');
    const license = registry.licenses.find((l) => l.id === 'neighbor_reports_odbl')!;
    expect(license.url).toBe('https://opendatacommons.org/licenses/odbl/1-0/');
    const corrections = registry.sources.find((s) => s.id === 'project_corrections')!;
    expect(corrections.endpoint).toMatchObject({ kind: 'curated', path: 'data/curated/interventions.yaml' });
  });
});
