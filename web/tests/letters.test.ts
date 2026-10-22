// Letter templates (M5.1, issue #45): where the letter to an owner is offered follows docs/ETHICS.md
// (organizations always, people only on parcels called vacant with high or medium confidence, and
// never "the owner" of public land); the letter to an owner never mentions buying, prices, taxes
// owed, death or estates; no letter mentions the police; what is typed stays under the site's own
// storage prefix and one button clears it.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseShard } from '../src/dossier/shard.ts';
import type { ShardParcel } from '../src/dossier/types.ts';
import { plain } from '../src/dossier/plain.ts';
import { ownerAddressee, ownerLetterGate } from '../src/letters/gate.ts';
import { LETTERS_KEY, LetterDrafts, draftKey, parseLetters } from '../src/letters/storage.ts';
import { EMPTY_FIELDS, TEMPLATES, addressLines, buildLetter, letterText, type LetterFields } from '../src/letters/templates.ts';
import type { KeyValueStore } from '../src/state/storage.ts';
import { collectStrings, strings } from '../src/strings.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const shard = parseShard(read('../fixtures/data/dossiers/9900.json')).shard!;
const parcel = (opa: string) => shard.parcels.get(opa)!;
const withConfidence = (p: ShardParcel, confidence: 'high' | 'medium' | 'low'): ShardParcel => ({ ...p, vacancy: { ...p.vacancy!, confidence } });

/** Words the letter to an owner must never use (owner, 2026-10-21). */
const NEVER_TO_OWNERS = /\b(buy|buying|bought|purchas\w*|sell|selling|sale|price\w*|tax|taxes|owe\w*|debt|died|death|dead|deceased|estate\w*|heirs?|est of|offer\w*|cash|value)\b/i;

function full(over: Partial<LetterFields> = {}): LetterFields {
  return {
    ...EMPTY_FIELDS,
    date: 'October 21, 2026',
    senderName: 'Pat Neighbor',
    group: 'Sample Street Block Club',
    contact: 'block@example.org',
    lotAddress: '1305 N EXAMPLE AVE',
    recipientName: 'Rosa Owner',
    recipientAddress: '455 EXAMPLE AVE, CHERRY HILL NJ 08002',
    plans: ['cleanup', 'garden', 'seating'],
    duration: 'this season',
    project: 'a cleanup and a small garden',
    requestNumber: '12345678',
    reportedOn: 'September 1, 2026',
    ...over,
  };
}

describe('where the letter to an owner is offered', () => {
  it('offers it for organizations at any confidence', () => {
    expect(ownerLetterGate(parcel('990000004')).offered).toBe(true); // a company
    expect(ownerLetterGate(parcel('990000033')).offered).toBe(true); // a nonprofit
    expect(ownerLetterGate(withConfidence(parcel('990000004'), 'low')).offered).toBe(true);
  });

  it('offers it for an owner who may be a person only on a parcel called vacant with high or medium confidence', () => {
    expect(ownerLetterGate(parcel('990000001')).offered).toBe(true);
    expect(ownerLetterGate(withConfidence(parcel('990000001'), 'medium')).offered).toBe(true);
    const low = ownerLetterGate(withConfidence(parcel('990000001'), 'low'));
    expect(low).toEqual({ offered: false, reason: 'not_sure', text: strings.letters.gate.not_sure });
    // A possible estate is a person too.
    expect(ownerLetterGate(withConfidence(parcel('990000005'), 'low')).offered).toBe(false);
    // No vacancy call at all: we are not sure.
    expect(ownerLetterGate({ ...parcel('990000001'), vacancy: null }).offered).toBe(false);
  });

  it('never offers it for public land, an owner the City does not name, or a parcel not on our list, and says why', () => {
    for (const opa of ['990000002', '990000009', '990000029', '990000098', '990000099']) {
      expect(ownerLetterGate(parcel(opa))).toMatchObject({ offered: false, reason: 'public' });
    }
    expect(ownerLetterGate(parcel('990000013'))).toMatchObject({ offered: false, reason: 'no_owner' });
    expect(ownerLetterGate(null)).toMatchObject({ offered: false, reason: 'not_listed' });
    for (const text of Object.values(strings.letters.gate)) expect(text.length).toBeGreaterThan(20);
  });

  it('fills in the owner as the City publishes it, but never words about an estate', () => {
    expect(ownerAddressee(parcel('990000001'), plain)).toMatchObject({ name: 'EXAMPLE DARNELL and EXAMPLE TINA', nameLeftOut: false });
    const estate = ownerAddressee(parcel('990000005'), plain);
    expect(estate.name).toBe('');
    expect(estate.nameLeftOut).toBe(true);
    expect(estate.address).not.toMatch(NEVER_TO_OWNERS);
    const careOf = ownerAddressee({ ...parcel('990000005'), owner: { ...parcel('990000005').owner!, mailing: 'C/O ESTATE OF ROSA SAMPLE, 455 EXAMPLE AVE, CHERRY HILL NJ 08002' } }, plain);
    expect(careOf.address).toBe('455 EXAMPLE AVE, CHERRY HILL NJ 08002');
    // The letter then begins "Dear property owner".
    const letter = buildLetter('owner', full({ recipientName: estate.name, recipientAddress: estate.address }));
    expect(letter.salutation).toBe(strings.letters.dearOwner);
    expect(letterText(letter)).not.toMatch(NEVER_TO_OWNERS);
  });
});

describe('the letters', () => {
  it('the letter to an owner asks permission to care for the lot and never mentions buying, prices, taxes, death or estates', () => {
    for (const fields of [full(), { ...EMPTY_FIELDS }, full({ plans: [], duration: '', extra: '' })]) {
      const text = letterText(buildLetter('owner', fields));
      expect(text).not.toMatch(NEVER_TO_OWNERS);
      expect(text).toContain('permission');
      expect(text).toContain('You can say no');
    }
    // Every piece of the template's own wording, too.
    const owned = collectStrings(strings.letters.owner).map(([, text]) => text).join(' ');
    expect(owned).not.toMatch(NEVER_TO_OWNERS);
    expect(letterText(buildLetter('owner', full()))).toContain('clean it up, plant a small garden and set up a place to sit');
  });

  it('no letter ever mentions the police, and the 311 follow up is about the place itself', () => {
    for (const template of TEMPLATES) {
      for (const problem of Object.keys(strings.letters.fields.problemOptions)) {
        const text = letterText(buildLetter(template, full({ problem, problemOther: 'a fallen fence' })));
        expect(text).not.toMatch(/\bpolice\b|\barrest|\benforcement\b|\bticket/i);
      }
    }
    const followup = letterText(buildLetter('followup', full({ problem: 'light' })));
    expect(followup).toContain('request number is 12345678');
    expect(followup).toContain('a broken street light at 1305 N EXAMPLE AVE');
  });

  it('the Council letter asks for the support chosen, and the side yard only from the neighbor next door', () => {
    expect(letterText(buildLetter('council', full({ ask: 'side_yard', recipientName: 'Avery Example' })))).toContain('I live next door');
    expect(letterText(buildLetter('council', full({ ask: 'cleanup' })))).toContain('needs a cleanup');
    expect(buildLetter('council', full({ recipientName: 'Avery Example' })).salutation).toBe('Dear Council member Avery Example,');
    expect(strings.letters.fields.askOptions.side_yard).toContain('only if you live next door');
  });

  it('the letter to a community organization asks for time at a meeting', () => {
    const letter = buildLetter('rco', full({ recipientName: 'Example Avenue Neighbors' }));
    expect(letter.salutation).toBe('Dear neighbors of Example Avenue Neighbors,');
    expect(letterText(letter)).toContain('a few minutes on the agenda');
  });

  it('marks what is still to fill in, and writes addresses on lines', () => {
    const blank = letterText(buildLetter('owner', { ...EMPTY_FIELDS }));
    expect(blank).toContain('[your name]');
    expect(blank).toContain('[how to reach you]');
    expect(addressLines('1400 John F Kennedy Blvd, City Hall Rm 484, Philadelphia, PA 19107')).toEqual([
      '1400 John F Kennedy Blvd',
      'City Hall Rm 484',
      'Philadelphia, PA 19107',
    ]);
    expect(addressLines('41 ORCHARD RD, CHERRY HILL NJ 08002')).toEqual(['41 ORCHARD RD', 'CHERRY HILL NJ 08002']);
  });

  it('every letter carries the note that a lawyer has not reviewed it, with where to get legal help', () => {
    expect(strings.letters.unreviewed).toBe('A lawyer has not reviewed this letter yet. It is not legal advice.');
    expect(strings.letters.legalHelp).toContain('Grounded in Philly');
    expect(strings.letters.legalHelp).toContain('Garden Justice Legal Initiative');
  });
});

describe('what is typed into a letter', () => {
  function memory(): KeyValueStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }

  it('is kept in this browser under the site\'s own prefix, the sender once for every letter', () => {
    const store = memory();
    const drafts = new LetterDrafts(store);
    drafts.set(draftKey('owner', '990000001'), 'senderName', 'Pat Neighbor');
    drafts.set(draftKey('owner', '990000001'), 'extra', 'We tend the garden next door.');
    expect([...store.data.keys()]).toEqual([`placekeepers:v1:${LETTERS_KEY}`]);
    const again = new LetterDrafts(store);
    expect(again.get(draftKey('owner', '990000001'))).toMatchObject({ senderName: 'Pat Neighbor', extra: 'We tend the garden next door.' });
    // The sender's name follows to another letter; that letter's own words do not.
    expect(again.get(draftKey('council', '990000001'))).toEqual({ senderName: 'Pat Neighbor' });
  });

  it('is cleared, all of it, with one button', () => {
    const store = memory();
    const drafts = new LetterDrafts(store);
    drafts.set(draftKey('rco', null), 'project', 'a mural');
    drafts.clear();
    expect(store.data.size).toBe(0);
    expect(drafts.get(draftKey('rco', null))).toEqual({});
  });

  it('is read forgivingly and kept small', () => {
    expect(parseLetters('not json')).toEqual({ sender: {}, drafts: {} });
    expect(parseLetters(JSON.stringify({ version: 1, drafts: { 'owner:990000001': { extra: 'x'.repeat(5000), plans: ['cleanup', 3] }, 'bad key': {} } }))).toEqual({
      sender: {},
      drafts: { 'owner:990000001': { extra: 'x'.repeat(2000), plans: ['cleanup'] } },
    });
    const store = memory();
    const drafts = new LetterDrafts(store);
    for (let i = 0; i < 45; i++) drafts.set(draftKey('owner', String(990000100 + i)), 'extra', `note ${i}`);
    expect(Object.keys(parseLetters(store.getItem(`placekeepers:v1:${LETTERS_KEY}`)).drafts)).toHaveLength(40);
  });

  it('is unavailable storage handled without losing the page', () => {
    const drafts = new LetterDrafts(null);
    drafts.set(draftKey('owner', null), 'extra', 'kept for this visit');
    expect(drafts.persistent).toBe(false);
    expect(drafts.get(draftKey('owner', null))).toMatchObject({ extra: 'kept for this visit' });
  });
});
