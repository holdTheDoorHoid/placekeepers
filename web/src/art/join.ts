// A work of public art in two or three sources is published as one record per source, each holding
// only what its own source says (tiles/art.pmtiles, docs/CONTRACTS.md section 4; decision D1 of
// docs/VERIFICATION_V0_2.md: OpenStreetMap's data never shares a record with data under another
// license). The records of one work share its id (`g`); the map draws one of them (`pr`), and this
// module joins them in the visitor's browser into what the details panel shows: the City's title,
// Wikidata's artist, a link to every source. It gives exactly what the pipeline's reference join
// gives (placekeepers.derive.art.join_published), which tests/art_join_parity.test.ts checks.

/** The record's own source, `s`: 1 the City, 2 OpenStreetMap, 4 Wikidata. */
export const ART_SOURCE = { city: 1, osm: 2, wikidata: 4 } as const;

type Props = Record<string, unknown>;

function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function first(key: string, order: (Props | undefined)[]): unknown {
  for (const record of order) if (record && present(record[key])) return record[key];
  return undefined;
}

/**
 * The work, joined from its records (one per source, any order; the drawn one need not come first).
 * A memorial shows no words that could name the person it remembers, even if a record carried some.
 */
export function joinArt(records: readonly Props[]): Props {
  const bySource = new Map<number, Props>();
  for (const record of records) bySource.set(Number(record.s), record);
  const city = bySource.get(ART_SOURCE.city);
  const osm = bySource.get(ART_SOURCE.osm);
  const wikidata = bySource.get(ART_SOURCE.wikidata);
  const any = records[0] ?? {};
  const out: Props = { id: any.g ?? any.id, k: any.k, src: any.src };
  const memorial = records.some((r) => r.mem === 1);
  if (memorial) {
    out.mem = 1;
  } else {
    out.ty = first('ty', [osm, wikidata, city]) ?? 0;
    const title = city && present(city.nm) && city.wt !== 1 ? city.nm : first('nm', [osm, wikidata, city]);
    const fields: [string, unknown][] = [
      ['nm', title],
      ['ar', first('ar', [wikidata, osm, city])],
      ['y', first('y', [city, wikidata, osm])],
      ['md', first('md', [city, osm])],
      ['lc', city?.lc],
    ];
    for (const [key, value] of fields) if (present(value)) out[key] = value;
    if (records.some((r) => r.in === 1)) out.in = 1;
  }
  if (city) {
    out.pa = city.pa;
    if (present(city.doc)) out.doc = city.doc;
  }
  if (osm) out.osm = osm.id;
  if (wikidata) out.wd = wikidata.id;
  if (!memorial) {
    const links: [string, unknown][] = [
      ['wp', first('wp', [wikidata, osm])],
      ['w', first('w', [osm, wikidata])],
    ];
    for (const [key, value] of links) if (present(value)) out[key] = value;
  }
  return out;
}

/**
 * The records of the work a drawn record belongs to: itself and the records `related` finds with
 * the same `g` (from the map's loaded data), without repeats. A record whose work has no other
 * record, or a lookup that finds none (a test, or a tile not loaded yet), joins alone.
 */
export function recordsOfWork(drawn: Props, related: (g: string) => Props[]): Props[] {
  const g = typeof drawn.g === 'string' ? drawn.g : null;
  const records = [drawn];
  if (!g) return records;
  const seen = new Set([String(drawn.id)]);
  for (const record of related(g)) {
    const id = String(record.id);
    if (record.g !== g || seen.has(id)) continue;
    seen.add(id);
    records.push(record);
  }
  return records;
}
