// "This owner holds 41 vacant parcels in the city" links to the owner's list (docs/ETHICS.md): every
// parcel on our list under the same owner names, from tables/owners.json (docs/CONTRACTS.md
// section 6). The file is read once, the first time someone opens a list.

import { isOpaAccount } from './opa.ts';
import type { Confidence, VacancyKind } from './types.ts';

export const OWNERS_TABLE_PATH = 'tables/owners.json';

export interface OwnerListParcel {
  id: string;
  address: string | null;
  kind: VacancyKind | null;
  confidence: Confidence | null;
}

export interface OwnerList {
  names: string[];
  parcels: OwnerListParcel[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim() : null);

function parcel(v: unknown): OwnerListParcel | null {
  // Early files listed accounts only.
  if (isOpaAccount(v)) return { id: v, address: null, kind: null, confidence: null };
  if (!isObj(v) || !isOpaAccount(v.id)) return null;
  return {
    id: v.id,
    address: text(v.address),
    kind: v.kind === 'lot' || v.kind === 'building' ? v.kind : null,
    confidence: v.confidence === 'high' || v.confidence === 'medium' || v.confidence === 'low' ? v.confidence : null,
  };
}

/** The owners table, by list id; null when the file cannot be used. */
export function parseOwnersTable(json: unknown): Map<string, OwnerList> | null {
  if (!isObj(json) || json.schema !== 1 || !isObj(json.owners)) return null;
  const out = new Map<string, OwnerList>();
  for (const [id, raw] of Object.entries(json.owners)) {
    if (!isObj(raw) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) continue;
    const names = Array.isArray(raw.names) ? raw.names.map(text).filter((n): n is string => n !== null) : [];
    const parcels = Array.isArray(raw.parcels) ? raw.parcels.map(parcel).filter((p): p is OwnerListParcel => p !== null) : [];
    out.set(id, { names, parcels });
  }
  return out;
}

let pending: Promise<Map<string, OwnerList> | null> | null = null;

/** One owner's list, or null when the table is not published, cannot be read, or has no such list. */
export async function loadOwnerList(
  dataBase: string,
  listId: string,
  files: Record<string, unknown> | null,
  fetchImpl: typeof fetch = fetch,
): Promise<OwnerList | null> {
  if (files && !(OWNERS_TABLE_PATH in files)) return null;
  pending ??= (async () => {
    try {
      const response = await fetchImpl(`${dataBase}${OWNERS_TABLE_PATH}`);
      return response.ok ? parseOwnersTable(await response.json()) : null;
    } catch {
      return null;
    }
  })();
  const table = await pending;
  if (!table) pending = null;
  return table?.get(listId) ?? null;
}

/** Forgets the downloaded table (for tests). */
export function clearOwnersTable(): void {
  pending = null;
}
