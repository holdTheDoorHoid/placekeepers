// The City's list of public property on the lot page (issue #36): each status in plain words, and
// the box for a lot the City's land agencies list as available, the same list the Philadelphia
// Land Bank's "View Properties Map" shows (source `city_owned_property`).
//
// The pipeline decides which lots are listed as available (pipeline/src/placekeepers/derive/
// city_list.py: a status that begins "Owned - Available") and says so in the dossier
// (`owner.city_owned.available`) and on the map (`la`). The records carry no date of their own,
// so the listing is dated by the day the pipeline last fetched the list (the manifest's
// `last_success` for the source).

import { LAND_BANK_MAP_URL } from '../config/links.ts';
import type { Manifest } from '../data/manifest.ts';
import { formatDate, sentenceCase, strings } from '../strings.ts';
import { plain } from './plain.ts';
import type { Link } from './types.ts';

export const CITY_LIST_SOURCE = 'city_owned_property';

/** A status as the City writes it, in capitals with single spaces: the key of the tables. */
export function statusKey(status: string): string {
  return status.replace(/\s+/g, ' ').trim().toUpperCase();
}

/** A status in plain words: what it is called and what it means for neighbors. */
export function cityStatusText(status: string): string {
  const known = strings.dossier.owner.cityStatuses[statusKey(status)];
  if (known) return `${strings.dossier.owner.cityListStatus(known[0])} ${known[1]}`;
  return strings.dossier.owner.cityListStatus(plain(sentenceCase(status)));
}

/** The day the City's list was fetched, as the lot page writes dates, or null. */
export function cityListDate(manifest: Manifest | null): string | null {
  const source = manifest?.sources[CITY_LIST_SOURCE];
  const when = source?.last_success ?? null;
  return when ? formatDate(when) : null;
}

export interface ListingText {
  title: string;
  /** Listed as available, with the date of the list and any limit the status names. */
  text: string;
  /** Said before the side yard route, when the lot may go to the neighbor as a side yard. */
  sideYardLead: string | null;
  /** The Land Bank's note that it may decline, in our words. */
  decline: string;
  changes: string;
  links: Link[];
  credit: string;
}

/** The words of the listed as available box, for a lot's status and the list's date. */
export function listingText(status: string | null, date: string | null, sideYard: boolean): ListingText {
  const l = strings.dossier.listing;
  const variant = status ? (l.variants[statusKey(status)] ?? null) : null;
  return {
    title: l.title,
    text: [date ? l.text(date) : l.textNoDate, variant].filter(Boolean).join(' '),
    sideYardLead: sideYard ? l.sideYardLead : null,
    decline: l.decline,
    changes: l.changes,
    links: [{ label: l.map, url: LAND_BANK_MAP_URL }],
    credit: l.credit,
  };
}
