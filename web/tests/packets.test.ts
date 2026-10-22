// Packets and who represents a lot (M5.1, issue #45): the contacts table and a dossier's `represent`
// are read forgivingly; the lot page names each seat with its office, source and the day it was
// checked; a packet shows the displacement card once, the flags exactly as docs/ETHICS.md allows
// them, the legal routes first with the conservatorship warning, and a contacts page listing each
// organization and seat once.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import DossierRepresent from '../src/components/dossier/DossierRepresent.svelte';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier } from '../src/dossier/build.ts';
import { parseCommon, parseShard } from '../src/dossier/shard.ts';
import type { ShardParcel } from '../src/dossier/types.ts';
import { buildPacket, MAX_PACKET, packetContacts, packetLot, type PacketLotInput } from '../src/packet/model.ts';
import { packetHash, readPacketHash, readViewHandoff, writeViewHandoff } from '../src/packet/load.ts';
import { parseContacts, parseRepresent, representView, wardText, type ContactsState } from '../src/represent/contacts.ts';
import { defaultState } from '../src/state/defaults.ts';
import type { KeyValueStore } from '../src/state/storage.ts';
import { strings } from '../src/strings.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const registry = loadRegistry();
const manifest = parseManifest(read('../fixtures/data/manifest.json')).manifest!;
const shard = parseShard(read('../fixtures/data/dossiers/9900.json')).shard!;
const notes = parseCommon(read('../fixtures/data/dossiers/common.json'));
const table = parseContacts(read('../fixtures/data/tables/contacts.json'))!;
const contacts: ContactsState = { status: 'ready', table };
const NOW = new Date('2026-10-21T15:00:00Z');
const ALL = ['990000001', '990000002', '990000004', '990000005', '990000009', '990000013', '990000029', '990000033', '990000098', '990000099'];

function lotInput(opa: string, parcel: ShardParcel | null = shard.parcels.get(opa) ?? null): PacketLotInput {
  return {
    opa,
    parcel,
    center: [-75.1557, 39.9851],
    view: buildDossier({
      opa,
      registry,
      state: defaultState(registry, 'analysis'),
      manifest,
      shard: parcel ? { status: 'found', parcel, generatedAt: shard.generatedAt, notes } : { status: 'absent', reason: 'unlisted' },
      tile: null,
      live: IDLE_PARTS,
      liveOn: false,
      center: null,
      now: NOW,
      contacts,
    }),
  };
}

function packetOf(ids: string[]) {
  return buildPacket({ title: 'Ten lots', lots: ids.map((id) => lotInput(id)), leftOut: 0, registry, contacts, dataDate: manifest.generated_at, lensLabel: 'Violence reduction', now: NOW });
}

describe('the contacts table', () => {
  it('reads every kind of seat, the members at large, the organizations and the empty seats', () => {
    expect([...table.seats.council.keys()]).toEqual(['5', '7']);
    expect(table.seats.council.get('7')).toMatchObject({ name: 'Avery Example', role: 'Council President', source: 'city_elected_officials', checked: '2026-10-04' });
    expect(table.councilAtLarge.map((s) => s.name)).toEqual(['Casey Sample', 'Morgan Example']);
    expect([...table.rcos.keys()]).toEqual(['54', '203', '310']);
    expect(table.vacant.house.has('201')).toBe(true);
    expect([...table.has].sort()).toEqual(['congress', 'council', 'house', 'rcos', 'senate']);
  });

  it('leaves out what it does not recognize, never guessing', () => {
    const parsed = parseContacts({
      schema: 1,
      council: { '7': { name: 'A', offices: [{ address: 'x', phone: '1' }, 'nonsense'], website: 'javascript:alert(1)', source: 's', checked: 'soon' }, x: { name: 'B' } },
      rcos: { '9': { name: 'R', contact: { email: 'not an email', phone: '215' } } },
    })!;
    const seat = parsed.seats.council.get('7')!;
    expect(seat.website).toBeNull();
    expect(seat.checked).toBeNull();
    expect(seat.offices).toHaveLength(1);
    expect(parsed.seats.council.size).toBe(1);
    expect(parsed.rcos.get('9')!.contact).toEqual({ name: null, phone: '215', email: null });
    expect(parsed.has.has('house')).toBe(false);
    expect(parseContacts({ schema: 2 })).toBeNull();
  });

  it('reads a dossier\'s represent and writes the ward and division in words', () => {
    const represent = parseRepresent({ ward: '7', division: '0719', council: 5, house: '195', rcos: [203, '54', 'x', 203] })!;
    expect(represent).toEqual({ ward: '7', division: '0719', council: '5', house: '195', senate: null, congress: null, rcos: ['203', '54'] });
    expect(wardText(represent)).toBe('Ward 7, division 19');
    expect(parseRepresent({})).toBeNull();
    expect(shard.parcels.get('990000001')!.represent!.rcos).toEqual(['54', '203']);
  });
});

describe('who represents you, on the lot page', () => {
  const atlas = { label: 'Atlas', url: 'https://atlas.phila.gov/990000001/voting' };

  it('names each seat with its office, its source and the day it was checked', () => {
    const view = representView(shard.parcels.get('990000001')!.represent, contacts, { listed: true, atlas });
    expect(view.status).toBe('ready');
    expect(view.ward).toBe('Ward 37, division 12');
    expect(view.rows.map((r) => [r.office, r.district, r.seat?.name ?? r.note])).toEqual([
      ['City Council', 'District 7', 'Avery Example'],
      ['Pennsylvania House', 'District 195', 'Taylor Example'],
      ['Pennsylvania Senate', 'District 3', 'Drew Example'],
      ['U.S. House of Representatives', 'District 3', 'Rowan Example'],
    ]);
    expect(view.rows[0]!.source).toBe('City of Philadelphia, its list of elected officials, checked October 4, 2026');
    expect(view.rcos.map((r) => r.rco.name)).toEqual(['Example Avenue Neighbors', 'Sample Street Block Association']);
    const html = render(DossierRepresent, { props: { represent: view } }).body;
    expect(html).toContain('Avery Example');
    expect(html).toContain('tel:2155550107');
    expect(html).toContain('neighbors@example.org');
    expect(html).toContain('href="https://atlas.phila.gov/990000001/voting"');
  });

  it('says a seat has no member listed, never an older name', () => {
    const view = representView(shard.parcels.get('990000098')!.represent, contacts, { listed: true, atlas });
    const house = view.rows.find((r) => r.kind === 'house')!;
    expect(house.seat).toBeNull();
    expect(house.note).toBe(strings.represent.vacant);
  });

  it('says why when it cannot tell: not on our list, not in this build, or still loading', () => {
    expect(representView(null, contacts, { listed: false, atlas }).status).toBe('unlisted');
    expect(representView(null, { status: 'missing' }, { listed: true, atlas }).status).toBe('missing');
    expect(representView(null, { status: 'loading' }, { listed: true, atlas }).status).toBe('loading');
    // 990000099 has a dossier but no represent.
    expect(representView(shard.parcels.get('990000099')!.represent, contacts, { listed: true, atlas }).status).toBe('missing');
    const noRco = representView(shard.parcels.get('990000033')!.represent, contacts, { listed: true, atlas });
    expect(noRco.rcoNote).toBe(strings.represent.noRco);
  });

  it('is part of the lot page view, built from the dossier and the table', () => {
    const view = lotInput('990000005').view;
    expect(view.represent.status).toBe('ready');
    expect(view.represent.links[0]!.url).toBe('https://atlas.phila.gov/990000005/voting');
  });
});

describe('a packet', () => {
  it('holds every lot in order, one page each, after the displacement card and the contacts', () => {
    const packet = packetOf(ALL);
    expect(packet.count).toBe(10);
    expect(packet.lots.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(packet.contents.slice(0, 2)).toEqual([strings.displacement.watchTitle, strings.packet.contents.contacts]);
    expect(packet.contents[2]).toBe('1. 1201 N SAMPLE ST');
  });

  it('shows the displacement card once, at the front, and the one line caution on each page it applies to', () => {
    const packet = packetOf(ALL);
    expect(packet.watch).not.toBeNull();
    expect(packet.watch!.cautions).toContain(strings.displacement.caution);
    expect(packet.watch!.areas).toHaveLength(1);
    expect(packet.watch!.areas[0]!.tract).toBe('42101900200');
    expect(packet.watch!.areas[0]!.lots.map((l) => l.n)).toEqual([6]);
    expect(packet.watch!.links.map((l) => l.id)).toEqual(['neighborhood_gardens_trust', 'community_land_trust', 'homestead_exemption', 'longtime_owner_occupants', 'tangled_title_help']);
    const inWatch = packet.lots[5]!;
    expect(inWatch.actions[0]!.caution).toBe(`${strings.displacement.caution} ${strings.packet.seeFront}`);
    // A greening card outside every watch area keeps the one line caution, without the pointer.
    const outside = packet.lots[3]!;
    expect(outside.actions[0]!.caution).toBe(strings.displacement.caution);
    // The full card's sentence is never repeated on the pages.
    for (const lot of packet.lots) expect(JSON.stringify(lot)).not.toContain('signs that prices are rising here:');
  });

  it('has no displacement card when no lot needs one', () => {
    const packet = packetOf(['990000001', '990000004']);
    expect(packet.watch).toBeNull();
    expect(packet.lots[0]!.actions.every((a) => a.caution === null || !a.caution.includes(strings.packet.seeFront))).toBe(true);
  });

  it('shows the flags exactly as docs/ETHICS.md allows them on each parcel', () => {
    const packet = packetOf(ALL);
    const estate = packet.lots[3]!;
    // A person's lot called vacant with high confidence: every flag, possible estate in full.
    expect(estate.flags.map((f) => f.title)).toContain(strings.dossier.owner.flagTitles.possible_estate);
    const estateFlag = estate.flags.find((f) => f.title === strings.dossier.owner.flagTitles.possible_estate)!;
    expect(estateFlag.text).toContain('Tangled Title Fund');
    expect(estate.deedFraud).toContain('Fraud Guard');
    // The same owner on a parcel we are not sure about: the flags about the owner are held back.
    const parcel = shard.parcels.get('990000005')!;
    const unsure = { ...parcel, vacancy: { ...parcel.vacancy!, confidence: 'low' as const } };
    const held = packetLot(lotInput('990000005', unsure), 1, registry, table, null, false);
    const titles = held.flags.map((f) => f.title);
    for (const id of ['absentee', 'possible_estate', 'tax_debt_2025', 'many_parcels']) expect(titles).not.toContain(strings.dossier.owner.flagTitles[id]);
    expect(held.held).toBe(strings.dossier.owner.heldBack);
    expect(held.deedFraud).toContain('Fraud Guard');
    // Packets never print an owner's names or mailing address: those stay on the lot page.
    expect(JSON.stringify(packet.lots)).not.toContain('EXAMPLE DARNELL');
    expect(JSON.stringify(packet.lots)).not.toContain('CHERRY HILL');
  });

  it('lists the legal routes first, with the conservatorship warning word for word', () => {
    const lot = packetOf(['990000001']).lots[0]!;
    expect(lot.routes.map((r) => r.label)).toEqual(['Ask the owner for permission', 'Conservatorship (Act 135)']);
    const ethics = readFileSync(new URL('../../docs/ETHICS.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');
    const warning = lot.routes[1]!.warning!;
    expect(ethics).toContain(warning);
    // The listing box leads with the side yard route, which is then not repeated.
    const landBank = packetOf(['990000009']).lots[0]!;
    expect(landBank.listing!.lines.some((line) => line.includes('side yard'))).toBe(true);
    expect(landBank.routes.map((r) => r.label)).not.toContain(registry.routes.find((r) => r.id === 'land_bank_side_yard')!.label);
  });

  it('carries the hearing, the rules, the soil note and who represents the lot', () => {
    const packet = packetOf(ALL);
    expect(packet.lots[3]!.hearing).toContain('November 6, 2030');
    expect(packet.lots[0]!.rules.some((r) => r.includes('Historical Commission'))).toBe(true);
    const garden = packet.lots[1]!.actions.find((a) => a.label === registry.suggestions.find((s) => s.id === 'community_garden')!.label);
    expect(garden?.soil).toBe(strings.dossier.rules.brownfield);
    expect(packet.lots[0]!.represent).toContain('City Council, District 7: Avery Example');
    expect(packet.lots[9]!.represent).toEqual([strings.packet.representUnknown]);
    expect(packet.lots[9]!.couldNotCheck).toContain(strings.packet.notChecked.represent);
  });

  it('lists each organization and seat once on the contacts page, with the lots it covers', () => {
    const c = packetContacts(ALL.map((id) => lotInput(id)), contacts);
    expect(c.rcos.map((g) => [g.item.rco.name, g.lots])).toEqual([
      ['Example Avenue Neighbors', [1, 2, 3, 4, 5]],
      ['North Sample Civic Council', [5, 6, 7]],
      ['Sample Street Block Association', [1, 9]],
    ]);
    expect(c.seats.council.map((g) => [g.key, g.lots])).toEqual([
      ['District 5', [5, 6, 7, 8]],
      ['District 7', [1, 2, 3, 4, 9]],
    ]);
    expect(c.seats.house.find((g) => g.key === 'District 201')!.item.note).toBe(strings.represent.vacant);
    expect(c.unknown).toEqual([10]);
    expect(c.wards[0]).toEqual({ n: 1, title: '1201 N SAMPLE ST', ward: 'Ward 37, division 12' });
    expect(packetContacts([lotInput('990000001')], { status: 'missing' }).status).toBe('missing');
  });

  it('offers the letter to the owner only where the flags about the owner may show, and says why not', () => {
    const lots = packetOf(ALL).lots;
    const gate = (n: number) => lots[n - 1]!.ownerLetter;
    expect(gate(1).offered).toBe(true); // a person, very likely vacant
    expect(gate(2)).toMatchObject({ offered: false, reason: 'public' }); // the City
    expect(gate(3).offered).toBe(true); // a company
    expect(gate(6)).toMatchObject({ offered: false, reason: 'no_owner' });
    expect(gate(8).offered).toBe(true); // a nonprofit
  });

  it('caps a packet and keeps its words in the house style', () => {
    expect(MAX_PACKET).toBe(50);
    const packet = packetOf(ALL);
    const text = JSON.stringify(packet);
    expect(findDashViolations(text.replace(/https?:\/\/\S+?"/g, '"'))).toEqual([]);
  });
});

describe('where a packet\'s places come from', () => {
  function memory(): KeyValueStore {
    const data = new Map<string, string>();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }

  it('reads the list or the hand over from after "#", never from a query the server sees', () => {
    expect(readPacketHash('#list=abc123&s=v%3Da')).toEqual({ list: 'abc123', fromView: false, state: 'v=a' });
    expect(readPacketHash('#from=view').fromView).toBe(true);
    expect(readPacketHash('#list=../../etc').list).toBeNull();
    expect(packetHash({ list: 'abc', state: 'l=x' })).toBe('list=abc&s=l%3Dx');
  });

  it('hands the places on the map to the packet tab through this browser\'s storage, under the site\'s prefix', () => {
    const store = memory();
    writeViewHandoff('Places on the map', [{ id: '990000001', address: null, center: [-75.15, 39.98], properties: { k: 1 } }], store);
    expect(store.getItem('placekeepers:v1:packet-view')).toContain('990000001');
    const list = readViewHandoff(store)!;
    expect(list.id).toBe('view');
    expect(list.places.map((p) => p.id)).toEqual(['990000001']);
    store.setItem('placekeepers:v1:packet-view', '{"places":[{"id":"nope"}]}');
    expect(readViewHandoff(store)).toBeNull();
  });
});
