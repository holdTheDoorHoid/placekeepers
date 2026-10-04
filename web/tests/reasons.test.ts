import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Manifest } from '../src/data/manifest.ts';
import { FIRST_DOUBT_BIT, placeReasons, reasonContext, reasonIds, REASONS, reasonSentence } from '../src/places/reasons.ts';
import { strings } from '../src/strings.ts';

const contracts = readFileSync(new URL('../../docs/CONTRACTS.md', import.meta.url), 'utf8');
const fixture = JSON.parse(readFileSync(new URL('../fixtures/sources/parcels.geojson', import.meta.url), 'utf8'));
const bit = (id: (typeof REASONS)[number]) => 2 ** REASONS.indexOf(id);

/** The rows of the reason bits table in docs/CONTRACTS.md section 4: bit, id, agrees or against. */
function contractRows(): [number, string, string][] {
  return [...contracts.matchAll(/^\| (\d+) \| \d+ \| `([a-z_]+)` \| .* \| (agrees|against) \|$/gm)].map((m) => [
    Number(m[1]),
    m[2]!,
    m[3]!,
  ]);
}

function manifestWith(dates: Record<string, string | null>): Manifest {
  const sources = Object.fromEntries(
    Object.entries(dates).map(([id, newest]) => [
      id,
      { status: 'ok', last_attempt: null, last_success: null, stale_since: null, rows: null, newest_record: newest, message: null },
    ]),
  );
  return { schema: 1, build_id: 'test', generated_at: null, sources, layers: {}, files: {}, notes: [] } as Manifest;
}

describe('reason bits', () => {
  it('match the table in docs/CONTRACTS.md, bit for bit', () => {
    const rows = contractRows();
    expect(rows).toHaveLength(REASONS.length);
    expect(rows.map(([b, id]) => [b, id])).toEqual(REASONS.map((id, b) => [b, id]));
    for (const [b, , side] of rows) expect(side).toBe(b >= FIRST_DOUBT_BIT ? 'against' : 'agrees');
  });

  it('each have a sentence', () => {
    const ctx = { cityLandDate: 'October 4, 2026', cityBuildingDate: null };
    for (const id of REASONS) {
      const text = reasonSentence(id, { dy: 2024, sy: 2025, ny: 2023 }, ctx);
      expect(text, id).toMatch(/^[A-Z]/);
      expect(text, id).not.toMatch(/undefined|null|NaN|\.$/);
    }
    expect(Object.keys(strings.reasons)).toEqual(expect.arrayContaining([...REASONS]));
  });

  it('are read from a number or a numeric string, ignoring bits this app does not know', () => {
    expect(reasonIds(bit('city_land') + bit('no_building'))).toEqual(['city_land', 'no_building']);
    expect(reasonIds(String(bit('sealed')))).toEqual(['sealed']);
    expect(reasonIds(2 ** 25 + bit('building_stands'))).toEqual(['building_stands']);
    expect(reasonIds(undefined)).toEqual([]);
    expect(reasonIds(-1)).toEqual([]);
    expect(reasonIds('many')).toEqual([]);
  });
});

describe('the reasons a place shows', () => {
  const manifest = manifestWith({ vacant_indicators_land: '2026-10-04', vacant_indicators_bldg: null });

  it('lists what says vacant, then what gives us pause, with the City list date', () => {
    const rs = bit('city_land') + bit('assessor_vacant_land') + bit('no_building') + bit('land_use_shows_use');
    expect(placeReasons({ rs }, reasonContext(manifest))).toEqual({
      agree: [
        'The City lists it as likely vacant land (list dated October 4, 2026)',
        'The assessor classifies it as vacant land',
        'No building stands on the parcel',
      ],
      doubt: ["The City's land use map shows it in use"],
    });
  });

  it('names the years of demolitions, seals and permits when the tile has them', () => {
    const ctx = reasonContext(manifest);
    expect(placeReasons({ rs: bit('demolished'), dy: 2024 }, ctx)!.agree).toEqual([
      'Demolished in 2024, with nothing built since',
    ]);
    expect(placeReasons({ rs: bit('sealed') + bit('recent_permit'), sy: 2025 }, ctx)).toEqual({
      agree: ['Sealed by the City in 2025, with no permit since'],
      doubt: ['A permit for building work or zoning was issued in the last two years'],
    });
    expect(placeReasons({ rs: bit('built_since'), ny: '2023' }, ctx)!.doubt).toEqual([
      'A new construction permit was issued in 2023, so a building may stand there now',
    ]);
    expect(placeReasons({ rs: bit('demolished') }, ctx)!.agree).toEqual(['Demolished, with nothing built since']);
  });

  it('leaves out a City list date that the manifest does not have', () => {
    expect(placeReasons({ rs: bit('city_building') }, reasonContext(manifest))!.agree).toEqual([
      'The City lists it as a likely vacant building',
    ]);
    expect(placeReasons({ rs: bit('city_land') }, reasonContext(null))!.agree).toEqual([
      'The City lists it as likely vacant land',
    ]);
  });

  it('says nothing when the tile has no reasons (a build from before the vacancy model)', () => {
    expect(placeReasons({ k: 1, vc: 2 }, reasonContext(manifest))).toBeNull();
    expect(placeReasons({ rs: 0 }, reasonContext(manifest))).toEqual({ agree: [], doubt: [] });
  });

  it('can explain every sample parcel, and each has a reason that says vacant', () => {
    for (const feature of fixture.features as { properties: Record<string, unknown> }[]) {
      const reasons = placeReasons(feature.properties, reasonContext(manifest))!;
      expect(reasons.agree.length, String(feature.properties.id)).toBeGreaterThan(0);
    }
  });
});
