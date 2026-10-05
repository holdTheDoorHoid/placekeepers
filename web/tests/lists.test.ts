// Saved lists live only in this browser (src/places/lists.svelte.ts): every read and write goes
// through storage that may fail, and lists still work for the visit when it does.

import { describe, expect, it } from 'vitest';
import { LISTS_KEY, ListStore, MAX_LISTS, MAX_LIST_PLACES, keptProperties, parseLists, serializeLists, type SavedPlace } from '../src/places/lists.svelte.ts';
import { storageKey, type KeyValueStore } from '../src/state/storage.ts';

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Storage that refuses everything, as a private window or blocked storage can. */
const broken: KeyValueStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const place = (id: string, extra: Partial<SavedPlace> = {}): SavedPlace => ({ id, address: null, center: null, properties: null, ...extra });

describe('saved lists', () => {
  it('starts a first list on the first save, and keeps it in this browser', () => {
    const storage = memory();
    const lists = new ListStore(storage);
    expect(lists.active).toBeNull();
    expect(lists.add(place('990000005', { address: '1305 N EXAMPLE AVE' }), 'My list')).toBe('added');
    expect(lists.active?.name).toBe('My list');
    expect(lists.has('990000005')).toBe(true);
    expect(lists.add(place('990000005'), 'My list')).toBe('already');
    expect(storage.data.has(storageKey(LISTS_KEY))).toBe(true);

    const again = new ListStore(storage);
    expect(again.active?.places).toEqual([place('990000005', { address: '1305 N EXAMPLE AVE' })]);
  });

  it('names, renames, switches, empties and deletes lists', () => {
    const lists = new ListStore(memory());
    const walk = lists.create('Block walk')!;
    lists.add(place('990000001'), 'My list');
    lists.add(place('990000009'), 'My list');
    const garden = lists.create('  Garden   ideas ')!;
    expect(garden.name).toBe('Garden ideas');
    expect(lists.active?.id).toBe(garden.id);
    lists.use(walk.id);
    expect(lists.active?.places.map((p) => p.id)).toEqual(['990000001', '990000009']);
    lists.removePlace('990000001');
    expect(lists.active?.places.map((p) => p.id)).toEqual(['990000009']);
    lists.rename(walk.id, 'Saturday walk');
    expect(lists.active?.name).toBe('Saturday walk');
    lists.delete(walk.id);
    expect(lists.active?.id).toBe(garden.id);
    expect(lists.lists).toHaveLength(1);
  });

  it('works for the visit when this browser keeps nothing, and says so', () => {
    const lists = new ListStore(broken);
    expect(lists.persistent).toBe(true);
    expect(lists.add(place('990000005'), 'My list')).toBe('added');
    expect(lists.has('990000005')).toBe(true);
    expect(lists.persistent).toBe(false);
  });

  it('holds limits: lists per browser and places per list', () => {
    const lists = new ListStore(memory());
    for (let i = 0; i < MAX_LISTS; i++) expect(lists.create(`List ${i}`)).not.toBeNull();
    expect(lists.create('One too many')).toBeNull();
    const full = new ListStore(memory());
    full.create('Big', Array.from({ length: MAX_LIST_PLACES }, (_, i) => place(String(990000000 + i))));
    expect(full.add(place('990999999'), 'My list')).toBe('full');
  });

  it('fills in an address once it is known, wherever the place is saved', () => {
    const lists = new ListStore(memory());
    lists.add(place('990000005'), 'My list');
    lists.update('990000005', { address: '1305 N EXAMPLE AVE', center: [-75.15572, 39.98513] });
    expect(lists.active?.places[0]).toMatchObject({ address: '1305 N EXAMPLE AVE', center: [-75.15572, 39.98513] });
  });

  it('reads saved lists forgivingly, leaving out anything it cannot use', () => {
    expect(parseLists(null)).toEqual({ lists: [], active: null });
    expect(parseLists('not json')).toEqual({ lists: [], active: null });
    expect(parseLists('{"version": 99, "lists": []}')).toEqual({ lists: [], active: null });
    const text = JSON.stringify({
      version: 1,
      active: 'gone',
      lists: [
        {
          id: 'a1',
          name: '',
          created: 'yesterday',
          places: [
            { id: '990000005', address: ' 1305 N EXAMPLE AVE ', center: [-75.15572, 39.98513], properties: { k: 1, rt: 5, f_vacant: 82, secret: 'x', ot: { nested: true } } },
            { id: '990000005' },
            { id: "1; DROP TABLE" },
            { id: '990000009', center: [0, 0] },
          ],
        },
        { id: 'a1', name: 'Same id twice', places: [] },
        { id: 'BAD ID', name: 'Bad', places: [] },
      ],
    });
    const { lists, active } = parseLists(text);
    expect(lists).toHaveLength(1);
    expect(active).toBe('a1');
    expect(lists[0]!.name).toBe('List');
    expect(lists[0]!.places).toEqual([
      { id: '990000005', address: '1305 N EXAMPLE AVE', center: [-75.15572, 39.98513], properties: { k: 1, rt: 5, f_vacant: 82 } },
      { id: '990000009', address: null, center: null, properties: null },
    ]);
    expect(parseLists(serializeLists(lists, 'a1'))).toEqual({ lists, active: 'a1' });
  });

  it('keeps only the tile properties a list needs', () => {
    expect(keptProperties({ id: '1', k: 2, vc: 3, ot: 1, lc: 0, rt: 5, sg: 'clean_and_green', f_shoot: 40, rs: 13, nm: 'x' })).toEqual({
      k: 2,
      vc: 3,
      ot: 1,
      lc: 0,
      rt: 5,
      sg: 'clean_and_green',
      f_shoot: 40,
    });
    expect(keptProperties(null)).toBeNull();
  });
});
