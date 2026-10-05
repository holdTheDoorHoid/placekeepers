// What the details panel says about a work of public art someone tapped (M3.2), from the tile
// properties of `art` in tiles/art.pmtiles (docs/CONTRACTS.md section 4): its kind, title, artist,
// year and material where a source gives them, where it is, and a link to each source.
//
// A memorial artwork (`mem` 1) shows only that it is a memorial artwork and its sources, linked by
// number. The pipeline publishes no words that could name the person it remembers; this module
// would not show them even if a file carried some (docs/ETHICS.md).

import { MURAL_ARTS_ARTWORKS_URL, osmEditUrl } from '../config/links.ts';
import { ART_KIND } from '../map/styles/public_art.ts';
import { strings } from '../strings.ts';

export interface ArtLink {
  label: string;
  url: string;
}

export interface ArtView {
  memorial: boolean;
  /** The heading: the title, else the kind ("A statue"), or "Memorial artwork". */
  heading: string;
  /** The kind in words when the heading is the title; null for a memorial. */
  kind: string | null;
  /** Short sentences: no title recorded, by, made in, made of, where, inside. */
  facts: string[];
  /** One link per source and page about the work. */
  links: ArtLink[];
  /** Mural Arts Philadelphia's own list, offered beside a mural; null otherwise. */
  muralArts: string | null;
  /** OpenStreetMap's editor, on this work or at its place. */
  fixUrl: string;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : NaN;
  return Number.isInteger(n) ? n : null;
}

function https(value: unknown): string | null {
  const url = text(value);
  return url && /^https?:\/\/[^\s/]+\.[^\s/]+/.test(url) ? url : null;
}

/** A site's name in words for a link ("the Association for Public Art's site"), else its host. */
export function siteName(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url;
  }
  for (const [domain, name] of Object.entries(strings.art.siteNames)) {
    if (host === domain || host.endsWith(`.${domain}`)) return name;
  }
  return host;
}

/**
 * The view of one work. `lngLat` is where it was tapped (for the editor link when OpenStreetMap
 * does not have the work yet), and `cityListUrl` the page of the City's list in the registry.
 */
export function describeArt(properties: Record<string, unknown>, lngLat: [number, number], cityListUrl: string | null): ArtView {
  const a = strings.art;
  const memorial = int(properties.mem) === 1;
  const osm = text(properties.osm);
  const wikidata = text(properties.wd);
  const links: ArtLink[] = [];
  if (int(properties.pa) !== null) {
    const doc = https(properties.doc);
    if (doc) links.push({ label: a.cityRecord, url: doc });
    else if (cityListUrl) links.push({ label: a.cityList, url: cityListUrl });
  }
  const osmMatch = /^([nw])(\d+)$/.exec(osm ?? '');
  if (osmMatch) links.push({ label: a.openOsm, url: `https://www.openstreetmap.org/${osmMatch[1] === 'n' ? 'node' : 'way'}/${osmMatch[2]}` });
  if (wikidata && /^Q\d+$/.test(wikidata)) links.push({ label: a.openWikidata, url: `https://www.wikidata.org/wiki/${wikidata}` });
  const fixUrl = osmEditUrl(osmMatch ? osm : null, lngLat[0], lngLat[1]);

  if (memorial) {
    return { memorial, heading: a.memorialTitle, kind: null, facts: [], links, muralArts: null, fixUrl };
  }

  const kindWords = a.kinds[int(properties.ty) ?? 0] ?? a.kinds[0]!;
  const title = text(properties.nm);
  const facts: string[] = [];
  if (!title) facts.push(a.untitled);
  const artist = text(properties.ar);
  if (artist) facts.push(a.by(artist));
  const year = int(properties.y);
  if (year !== null && year >= 1600 && year <= 2100) facts.push(a.made(year));
  const medium = text(properties.md);
  if (medium) facts.push(a.medium(medium));
  const place = text(properties.lc);
  if (place) facts.push(a.where(place));
  if (int(properties.in) === 1) facts.push(a.inside);
  const wikipedia = https(properties.wp);
  if (wikipedia) links.push({ label: a.openWikipedia, url: wikipedia });
  const website = https(properties.w);
  if (website) links.push({ label: a.website(siteName(website)), url: website });
  return {
    memorial,
    heading: title ?? kindWords,
    kind: title ? kindWords : null,
    facts,
    links,
    muralArts: int(properties.k) === ART_KIND.mural ? MURAL_ARTS_ARTWORKS_URL : null,
    fixUrl,
  };
}
