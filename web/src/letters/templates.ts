// The letter templates (M5.1, issue #45): low stakes letters a neighbor fills in and prints. Each is
// a plain function of what was typed, so tests can check every word: the letter to an owner never
// mentions buying, prices, taxes owed, death or estates (owner, 2026-10-21), and none of them ever
// mentions the police (docs/ETHICS.md, "Policing").

import { strings } from '../strings.ts';

export const TEMPLATES = ['owner', 'council', 'rco', 'followup'] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export function isTemplate(value: unknown): value is TemplateId {
  return typeof value === 'string' && (TEMPLATES as readonly string[]).includes(value);
}

/** Everything a letter may hold, as typed (or filled in from the City's records, then edited). */
export interface LetterFields {
  date: string;
  senderName: string;
  group: string;
  contact: string;
  lotAddress: string;
  recipientName: string;
  recipientAddress: string;
  /** owner */
  plans: string[];
  duration: string;
  /** council */
  ask: string;
  /** rco */
  project: string;
  /** followup */
  requestNumber: string;
  reportedOn: string;
  problem: string;
  problemOther: string;
  extra: string;
}

export const EMPTY_FIELDS: LetterFields = {
  date: '',
  senderName: '',
  group: '',
  contact: '',
  lotAddress: '',
  recipientName: '',
  recipientAddress: '',
  plans: [],
  duration: '',
  ask: 'land_bank',
  project: '',
  requestNumber: '',
  reportedOn: '',
  problem: 'dumping',
  problemOther: '',
  extra: '',
};

/** The longest text kept for one field, so a draft stays small. */
export const MAX_FIELD = 2000;

export interface Letter {
  date: string;
  /** The recipient's name and address, one line each. */
  to: string[];
  subject: string | null;
  salutation: string;
  paragraphs: string[];
  closing: string;
  signature: string[];
}

/** The words a letter is written with: the strings of the letter's language. */
export type LetterText = Pick<typeof strings, 'letters' | 'join'>;

/** "a, b and c", in the letter's language (strings.join.and). */
export function listWords(items: string[], text: LetterText = strings): string {
  return text.join.and(items);
}

/**
 * An address as lines for the top of a letter: what was typed on separate lines stays so; a line
 * with commas, as the City writes addresses, is split at them, keeping "PA 19107" with its city.
 */
export function addressLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(',').map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      if (out.length && /^[A-Z]{2}\s+\d{5}(-\d{4})?$/i.test(part) && parts.length > 1) out[out.length - 1] += `, ${part}`;
      else out.push(part);
    }
  }
  return out;
}

/** The salutation's name: the recipient's own words, or the template's default. */
function firstLine(text: string): string {
  return text.split(/\r?\n/)[0]?.trim() ?? '';
}

/**
 * The letter, in the language of `text` (the page's own by default). Numbers and dates follow the
 * formatters in use, so build a letter in another language inside withLocale (src/i18n/locale.ts).
 * What was typed is used as typed.
 */
export function buildLetter(template: TemplateId, f: LetterFields, text: LetterText = strings): Letter {
  const l = text.letters;
  const extra = f.extra.trim() ? [f.extra.trim()] : [];
  const reach = f.contact.trim() ? l.reachMe(f.contact.trim()) : l.reachMeBlank;
  const signature = [f.senderName.trim() || l.yourName, ...(f.group.trim() ? [f.group.trim()] : [])];
  const to = [...f.recipientName.split(/\r?\n/).map((x) => x.trim()).filter(Boolean), ...addressLines(f.recipientAddress)];
  const base = { date: f.date.trim(), to, subject: null as string | null, closing: l.sincerely, signature };
  const me = l.me(f.senderName.trim(), f.group.trim());
  switch (template) {
    case 'owner': {
      const planWords = listWords(
        f.plans.map((id) => l.fields.planOptions[id]).filter((x): x is string => !!x),
        text,
      );
      const name = firstLine(f.recipientName);
      return {
        ...base,
        salutation: name ? l.salutation(name) : l.dearOwner,
        paragraphs: [`${me} ${l.owner.intro(f.lotAddress.trim())}`, l.owner.ask(planWords), ...extra, l.owner.terms(f.duration.trim()), l.owner.writing, reach, l.thanks],
      };
    }
    case 'council': {
      return {
        ...base,
        salutation: l.council.dear(firstLine(f.recipientName)),
        paragraphs: [
          `${l.council.intro(f.group.trim(), f.lotAddress.trim())}`,
          l.council.ask[f.ask] ?? l.council.ask.land_bank!,
          ...extra,
          `${l.council.meet} ${reach}`,
          l.thanksHelp,
        ],
      };
    }
    case 'rco': {
      return {
        ...base,
        salutation: l.rco.dear(firstLine(f.recipientName)),
        paragraphs: [`${me} ${l.rco.intro(f.project.trim(), f.lotAddress.trim())}`, l.rco.ask, ...extra, reach, l.thanks],
      };
    }
    case 'followup': {
      const problem = f.problem === 'other' ? f.problemOther.trim() : (l.fields.problemOptions[f.problem] ?? '');
      return {
        ...base,
        subject: l.followup.subject(f.requestNumber.trim()),
        salutation: l.followup.dear(firstLine(f.recipientName)),
        paragraphs: [
          me,
          l.followup.reported(f.reportedOn.trim(), problem, f.lotAddress.trim(), f.requestNumber.trim()),
          l.followup.ask,
          ...extra,
          reach,
          l.thanksHelp,
        ],
      };
    }
  }
}

/** The whole letter as plain text, in reading order (for tests and for the screen reader summary). */
export function letterText(letter: Letter): string {
  return [letter.date, ...letter.to, letter.subject ?? '', letter.salutation, ...letter.paragraphs, letter.closing, ...letter.signature]
    .filter(Boolean)
    .join('\n');
}
