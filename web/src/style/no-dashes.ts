// The house style (the project's CLAUDE.md): no dashes as punctuation in text people read. No
// em dashes, no en dashes, no spaced hyphen used as a pause. Hyphens inside compound words,
// identifiers, command flags and file names are fine, and so is a hyphen at the very start of a
// line (a Markdown or YAML list marker: "- like this"). Write ranges as "2019 to 2024" instead
// of "2019-2024" or "2019 to 2024".
//
// Used at build time (plugins/content.ts, so a stray dash fails the build) and by tests
// (tests/strings.test.ts, so it fails CI on every pull request).

const EM_OR_EN_DASH = /[–—]/g;

// A hyphen with a real character on each side, separated by a space or a tab: "low - sometimes
// free". A list marker ("- item") has nothing but a line start or more whitespace before its
// leading space, so it can never match. Tabs and spaces only (not "\s"), so a hyphen at the very
// start of a new line is never joined to the end of the line before it.
const SPACED_HYPHEN = /\S[ \t]+-[ \t]+\S/g;

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

function snippetAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 20);
  const to = Math.min(text.length, end + 20);
  return text.slice(from, to).replace(/\s+/g, ' ').trim();
}

/** Lists every dash style violation in `text`, each a short message naming the line and a snippet. */
export function findDashViolations(text: string): string[] {
  const problems: string[] = [];

  for (const match of text.matchAll(EM_OR_EN_DASH)) {
    const index = match.index ?? 0;
    const kind = match[0] === '—' ? 'em dash' : 'en dash';
    problems.push(`${kind} on line ${lineOf(text, index)}: "${snippetAround(text, index, index + 1)}"`);
  }

  for (const match of text.matchAll(SPACED_HYPHEN)) {
    const index = match.index ?? 0;
    problems.push(`spaced hyphen on line ${lineOf(text, index)}: "${snippetAround(text, index, index + match[0].length)}"`);
  }

  return problems;
}
