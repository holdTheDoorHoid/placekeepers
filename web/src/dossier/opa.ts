// OPA account numbers: the City's id for a property, always exactly nine digits. Every live
// lookup checks an account with isOpaAccount before it goes anywhere near a query, and nothing a
// person types ever goes into SQL (see ./carto.ts).

export const OPA_ACCOUNT = /^\d{9}$/;

/** True only for a string of exactly nine digits. */
export function isOpaAccount(value: unknown): value is string {
  return typeof value === 'string' && OPA_ACCOUNT.test(value);
}

/**
 * Nine digits from a City record, or null. Some City tables store the account as a number or
 * drop its leading zero ("72106400"), so eight digits are padded. Anything else, such as text
 * with letters, is refused. Only for values that come from City servers, never for typed text.
 */
export function normalizeAccount(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isInteger(value) && value >= 0 ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{8,9}$/.test(text)) return null;
  return text.padStart(9, '0');
}

/** The dossier shard that holds an account: its first three digits (docs/CONTRACTS.md). */
export function shardPrefix(opa: string): string {
  if (!isOpaAccount(opa)) throw new Error('An OPA account must be exactly nine digits.');
  return opa.slice(0, 3);
}

/** The shard's path under the data root, such as "dossiers/372.json". */
export function shardPath(opa: string): string {
  return `dossiers/${shardPrefix(opa)}.json`;
}
