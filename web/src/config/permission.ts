// The first lawful step to get permission for a parcel: the tile property `rt` (docs/CONTRACTS.md
// section 4), a category the pipeline takes from the first route of the parcel's dossier.
//
// It names a kind of step, never a score or an order of how easy a parcel would be to get
// (docs/ETHICS.md, "Things we do not build"). So the categories always appear in this one fixed
// order, the order of their codes, in the filter and on the plot; nothing ever sorts by them.

import { strings } from '../strings.ts';

/** Every code, in the fixed order the site shows them. */
export const PERMISSION_CODES = [0, 1, 2, 3, 4, 5] as const;
export type PermissionCode = (typeof PERMISSION_CODES)[number];

/**
 * The registry route each code stands for: the route the dossier lists first
 * (pipeline/src/placekeepers/derive/routes.py). A public body other than the City, the Land Bank,
 * the Redevelopment Authority and PHDC is asked as the owner. Code 0 has no route yet.
 */
export const PERMISSION_ROUTE: Record<PermissionCode, string | null> = {
  0: null,
  1: 'community_landcare',
  2: 'land_bank_garden_agreement',
  3: 'contact_phdc',
  4: 'ask_the_owner',
  5: 'ask_the_owner',
};

/** The routes that are about permission to use the land, as opposed to reporting a problem. */
export const PERMISSION_ROUTES: ReadonlySet<string> = new Set(
  Object.values(PERMISSION_ROUTE).filter((id): id is string => id !== null),
);

/** The code in a parcel's tile properties, or null when the tiles do not carry it yet. */
export function permissionCode(properties: Record<string, unknown> | null | undefined): PermissionCode | null {
  const raw = properties?.rt;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  return (PERMISSION_CODES as readonly number[]).includes(n) ? (n as PermissionCode) : null;
}

/** A short label, for chips, table cells and the plot. */
export function permissionLabel(code: PermissionCode | null): string {
  return code === null ? strings.permission.notPublished : strings.permission.short[code];
}

/** The full sentence: who owns it and what the first step is. */
export function permissionText(code: PermissionCode | null): string {
  return code === null ? strings.permission.notPublished : strings.permission.long[code];
}

/**
 * The code for a parcel known only from its dossier (such as a place in an imported list): the
 * category of the dossier's first route, the same rule the pipeline uses to make `rt`. The side
 * yard route is passed over: it is for the household next door only (issue #36).
 */
export function permissionFromRoutes(routes: readonly string[], publicOwner: boolean): PermissionCode {
  const first = routes.find((id) => id !== 'land_bank_side_yard') ?? routes[0];
  switch (first) {
    case 'community_landcare':
      return 1;
    case 'land_bank_garden_agreement':
    case 'land_bank_side_yard':
      return 2;
    case 'contact_phdc':
      return 3;
    case 'ask_the_owner':
      return publicOwner ? 4 : 5;
    default:
      return 0;
  }
}
