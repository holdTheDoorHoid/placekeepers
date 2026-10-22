// The flyer's languages (M5.2 issue #46, after M5.5): any language of the site, the page's own by
// default, and English beside it in a second column if the organizers want. Each language's words
// come from its own catalog (src/i18n/boot.ts, stringsIn); what was typed prints as typed.

import { describe, expect, it } from 'vitest';
import { defaultFields, flyerWords, readFlyers, typedHeadline, writeFlyers, type FlyerFields } from '../src/flyer/flyer.ts';
import { stringsIn } from '../src/i18n/boot.ts';
import { englishStrings } from '../src/i18n/english.ts';
import es from '../src/i18n/locales/es.ts';
import type { KeyValueStore } from '../src/state/storage.ts';

const lot = { opa: '990000005', address: '1305 N EXAMPLE AVE' };
const fields: FlyerFields = { ...defaultFields(), hopes: ['garden', 'cleanup'], ownWords: 'Zq9 keep it open for kids', ownLinkLabel: '' };

class MemoryStore implements KeyValueStore {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

describe('a flyer in another language', () => {
  it('takes every word it prints from that language, and what was typed as typed', async () => {
    const spanish = (await stringsIn('es'))!;
    const words = flyerWords(spanish, 'es', fields, lot);
    expect(words.headline).toBe(es.flyer!.defaultHeadline);
    expect(words.hopeTitle).toBe(es.flyer!.hopeTitle);
    expect(words.hopes).toEqual([es.flyer!.hopeLines!.cleanup, es.flyer!.hopeLines!.garden]);
    expect(words.ownWords).toBe('Zq9 keep it open for kids');
    expect(words.place).toBe('1305 N EXAMPLE AVE');
    expect(words.dir).toBe('ltr');
  });

  it('puts what was typed in the first column only, when English is printed beside it', () => {
    const english = flyerWords(englishStrings(), 'en', fields, lot, false);
    expect(english.headline).toBe('Neighbors care about this lot');
    expect(english.hopes).toEqual(['Clean it up together', 'Plant a garden']);
    expect(english.ownWords).toBeNull();
  });

  it('reads right to left in Arabic, and names a lot with no address in its own words', async () => {
    const arabic = (await stringsIn('ar'))!;
    const words = flyerWords(arabic, 'ar', fields, { opa: lot.opa, address: null });
    expect(words.dir).toBe('rtl');
    expect(words.place).toContain('990000005');
    expect(words.place).not.toContain('Parcel');
  });

  it('shows a default headline in each language, and a typed one as typed', async () => {
    const defaults = [englishStrings().flyer.defaultHeadline, (await stringsIn('es'))!.flyer.defaultHeadline];
    expect(typedHeadline({ headline: 'Neighbors care about this lot' }, defaults)).toBeNull();
    expect(typedHeadline({ headline: ` ${es.flyer!.defaultHeadline} ` }, defaults)).toBeNull();
    expect(typedHeadline({ headline: '' }, defaults)).toBeNull();
    expect(typedHeadline({ headline: 'Our block garden' }, defaults)).toBe('Our block garden');
  });

  it('keeps the chosen language in this browser with the rest, and nothing that is not a language', () => {
    const store = new MemoryStore();
    writeFlyers({ '990000005': { ...fields, language: 'vi', withEnglish: true } }, store);
    expect(readFlyers(store)['990000005']).toMatchObject({ language: 'vi', withEnglish: true });
    writeFlyers({ '990000005': { ...fields, language: 'xx' as never, withEnglish: 'yes' as never } }, store);
    const kept = readFlyers(store)['990000005']!;
    expect(kept.language).toBeUndefined();
    expect(kept.withEnglish).toBeUndefined();
  });
});
