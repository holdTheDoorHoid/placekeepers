// Where the letter asking a lot's owner for permission is offered (M5.1, issue #45; docs/ETHICS.md,
// "Owner information"): exactly where the flags about the owner may show. An organization (a
// company or a nonprofit) always; an owner who may be a person (typed as one, of a type we could
// not tell, or whose names carry an estate) only on a parcel the map calls vacant with high or
// medium confidence, because a parcel we are not sure about may be someone's home. Public land is
// asked through the City's and the Land Bank's own programs, so no letter to "the owner" is
// offered there; the letter to the Council office covers it. When the letter is not offered, the
// page says why.
//
// The site never sends a letter: it is filled in and printed in this browser (docs/ETHICS.md,
// "Things we do not build"), one lot at a time.

import { ownerFlagAllowed, personLike } from '../dossier/flags.ts';
import { estateWords, isPrivate, possibleEstate } from '../dossier/owners.ts';
import { PUBLIC_OWNER_TYPES, type ShardParcel } from '../dossier/types.ts';
import { strings } from '../strings.ts';

export type OwnerLetterReason = 'public' | 'not_sure' | 'no_owner' | 'not_listed';

export type OwnerLetterGate = { offered: true } | { offered: false; reason: OwnerLetterReason; text: string };

/** Whether the letter to the owner is offered for this lot, and why not when it is not. */
export function ownerLetterGate(parcel: ShardParcel | null): OwnerLetterGate {
  const l = strings.letters.gate;
  if (!parcel || !parcel.owner) return { offered: false, reason: 'not_listed', text: l.not_listed };
  const { type, names } = parcel.owner;
  if (PUBLIC_OWNER_TYPES.has(type)) return { offered: false, reason: 'public', text: l.public };
  if (!isPrivate(type, names.length > 0) || names.length === 0) return { offered: false, reason: 'no_owner', text: l.no_owner };
  const confidence = parcel.vacancy?.confidence ?? null;
  const rule = { personLike: personLike(type, names), calledVacant: confidence === 'high' || confidence === 'medium', homestead: false };
  // The same rule as the flags about the owner (absentee is one of them).
  if (!ownerFlagAllowed('absentee', rule)) return { offered: false, reason: 'not_sure', text: l.not_sure };
  return { offered: true };
}

/**
 * What the City's records fill in at the top of the letter to an owner: the names and mailing
 * address as published, except words about an estate, which this letter never uses (owner,
 * 2026-10-21). An owner whose names carry them is left blank, so the letter begins "Dear property
 * owner", and so is any part of the address that carries them.
 */
export function ownerAddressee(parcel: ShardParcel | null, clean: (text: string | null) => string | null): { name: string; address: string; nameLeftOut: boolean } {
  const names = parcel?.owner?.names ?? [];
  const estate = possibleEstate(names) || names.some(estateWords);
  const mailing = clean(parcel?.owner?.mailing ?? null) ?? '';
  const address = mailing
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !estateWords(part))
    .join(', ');
  return {
    name: estate ? '' : names.map((n) => clean(n) ?? n).join(' and '),
    address,
    nameLeftOut: estate,
  };
}
