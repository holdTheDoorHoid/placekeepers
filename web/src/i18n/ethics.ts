// The passages docs/ETHICS.md fixes word for word, and where each one lives. Each is one key (or,
// for the possible estate flag, three consecutive fixed sentences), never a template with values
// spliced in, so a translator translates it whole, with special care, and a back translation can
// check it whole. Their English is checked against ETHICS.md by tests/dossier_flags.test.ts and
// tests/interface_ethics.test.ts; tests/i18n.test.ts checks they stay fixed units.

export interface WordForWord {
  /** The passage's name in ETHICS.md. */
  passage: string;
  /** Keys in web/src/strings.ts, in reading order. */
  keys: readonly string[];
  /** Registry text paths (registry/i18n/<code>.yaml) that carry the same words. */
  registry?: readonly string[];
}

export const WORD_FOR_WORD: readonly WordForWord[] = [
  {
    passage: 'Possible estate',
    keys: ['dossier.flags.possible_estate.text', 'dossier.flags.possible_estate.careful', 'dossier.flags.possible_estate.next'],
  },
  {
    passage: 'Conservatorship warning',
    keys: ['dossier.actions.conservatorshipWarning'],
    registry: ['routes.conservatorship.warning'],
  },
  { passage: 'Deed fraud notice', keys: ['dossier.owner.deedFraud'] },
  { passage: 'Displacement caution (greening)', keys: ['displacement.caution'] },
  { passage: 'Displacement caution (gardens, seating and art)', keys: ['displacement.placemakingCaution'] },
  { passage: 'Brownfield soil note', keys: ['dossier.rules.brownfield'] },
];
