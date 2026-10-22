// Sentences the pipeline writes in English into the weekly copy (issue #49): a page in another
// language writes them again from the codes and values beside them, with its own templates. These
// tests check that the templates, in English, say exactly what the pipeline said, so a translation
// of them carries the same facts; and that a page in another language uses them.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier } from '../src/dossier/build.ts';
import { flagTextFromData } from '../src/dossier/flags.ts';
import { ownerTypeWithAgency } from '../src/dossier/owners.ts';
import { parseCommon, parseShard } from '../src/dossier/shard.ts';
import { applyCatalog } from '../src/i18n/catalog.ts';
import { setLocale } from '../src/i18n/locale.ts';
import { FALLBACK_START, textKind } from '../src/i18n/marks.ts';
import { defaultState } from '../src/state/defaults.ts';
import { strings } from '../src/strings.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const RAW = read('../fixtures/data/dossiers/9900.json');
const shard = parseShard(RAW).shard!;
const notes = parseCommon(read('../fixtures/data/dossiers/common.json'));
const manifest = parseManifest(read('../fixtures/data/manifest.json')).manifest!;
const registry = loadRegistry();
const builtOn = shard.generatedAt?.slice(0, 10) ?? null;

type RawFlag = { id: string; text: string; data?: Record<string, unknown> };
type RawOwner = { names: string[]; type: string; type_reason: string | null; flags?: RawFlag[]; city_owned?: { agency?: string } | null };
const owners = Object.values(RAW.parcels as Record<string, { owner?: RawOwner }>)
  .map((p) => p.owner)
  .filter((o): o is RawOwner => !!o);

describe('the flags of the weekly copy, written again from their data', () => {
  const flags = owners.flatMap((o) => o.flags ?? []).filter((f) => f.data || f.id === 'possible_estate' || f.id === 'unsafe');

  it('covers every kind of flag the sample has', () => {
    expect(new Set(flags.map((f) => f.id)).size).toBeGreaterThanOrEqual(8);
  });

  it.each(flags.map((f) => [f.id, f] as const))('%s says what the pipeline said', (_id, flag) => {
    expect(flagTextFromData(flag.id, flag.data ?? {}, builtOn)).toBe(flag.text);
  });
});

describe('the owner type reason, written again from the names and the City list', () => {
  // The sample's hand written owners on the City list do not all follow the pipeline's agency
  // rule, so they are checked against the pipeline's own answers below instead.
  it.each(owners.filter((o) => o.type_reason && !o.city_owned).map((o) => [o.names.join(' / '), o] as const))('%s', (_names, owner) => {
    const again = ownerTypeWithAgency(owner.names, owner.city_owned?.agency ?? null);
    expect(again.type).toBe(owner.type);
    expect(again.reason).toBe(owner.type_reason);
  });

  it("gives the pipeline's answer for every owner name it was asked about", () => {
    const parity = JSON.parse(readFileSync(new URL('../../pipeline/tests/fixtures/wording_parity.json', import.meta.url), 'utf8'));
    const cases = parity.owner_type as { names: string[]; type: string; reason: string }[];
    expect(cases.length).toBeGreaterThan(10);
    for (const c of cases) expect(ownerTypeWithAgency(c.names, null), c.names.join(' / ')).toEqual({ type: c.type, reason: c.reason });
  });

  it('says to ask which owner is current when the City list and the names disagree', () => {
    expect(ownerTypeWithAgency(['SAMPLE HOLDINGS LLC'], 'PLB')).toEqual({
      type: 'land_bank',
      reason:
        "The City's list of public property names the Philadelphia Land Bank as the owner. City property records name a different owner, so ask the Land Bank which is current.",
    });
  });
});

describe('a lot page in another language', () => {
  // Each test file has its own copy of the strings, so this catalog stays in this file. It is
  // written in before these tests only, after the English ones above have run.
  let views: ReturnType<typeof buildDossier>[] = [];
  let flags: ReturnType<typeof buildDossier>['owner']['flags'] = [];
  beforeAll(() => {
    applyCatalog(strings, {
      dossier: {
        flags: {
          many_parcels: { text: (n: number) => `Este dueño tiene ${n} parcelas vacías.`, careful: 'Cuidado.' },
          absentee: { outOfState: (where: string) => `Recibe correo en otro lugar: ${where}.` },
        },
        owner: { deedFraud: 'Aviso de fraude de escrituras.' },
        ownerType: { individual: 'El nombre parece de una persona.' },
      },
    });
    setLocale('es');
    views = [...shard.parcels.entries()].map(([opa, parcel]) =>
      buildDossier({
        opa,
        registry,
        state: defaultState(registry, 'analysis'),
        manifest,
        shard: { status: 'found', parcel, generatedAt: shard.generatedAt, notes },
        tile: null,
        live: IDLE_PARTS,
        liveOn: false,
        center: null,
        now: new Date('2026-10-04T18:30:00Z'),
      }),
    );
    flags = views.flatMap((v) => v.owner.flags);
  });
  afterAll(() => setLocale('en'));

  it("writes the flags in the page's words, and keeps the rest English, marked", () => {
    const many = flags.find((f) => f.id === 'many_parcels');
    expect(many?.text).toMatch(/^Este dueño tiene \d+ parcelas vacías\.$/);
    expect(many?.careful).toBe('Cuidado.');
    const away = flags.find((f) => f.id === 'absentee' && f.text.includes('otro lugar'));
    expect(away?.text).toMatch(/^Recibe correo en otro lugar: .+\.$/);
    // A flag no template here translates still reads in English, marked as English.
    const other = flags.find((f) => f.id === 'sheriff_sales');
    expect(other && textKind(other.text)).toBe('fallback');
    // No careful note or next step comes from the weekly copy's English while the page has words.
    for (const f of flags) if (f.careful) expect(f.careful === 'Cuidado.' || f.careful.startsWith(FALLBACK_START), f.id).toBe(true);
  });

  it("shows the page's deed fraud notice and writes the owner type reason again", () => {
    const deed = views.find((v) => v.owner.deedFraud)?.owner.deedFraud;
    expect(deed?.text).toBe('Aviso de fraude de escrituras.');
    const person = views.find((v) => v.owner.typeLabel === strings.dossier.ownerType.labels.individual);
    expect(person?.owner.typeReason).toBe('El nombre parece de una persona.');
  });
});
