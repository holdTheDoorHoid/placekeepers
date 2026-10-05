// "What you can do nearby" in the field view lists vacant lots and bus or trolley stops together,
// nearest first (M2.3). Each list arrives sorted by distance; this merges them into one.

import type { NearbyStop } from '../transit/comfort.ts';
import type { NearbyPlace } from './rank.ts';

export type NearbyItem =
  | { kind: 'place'; key: string; distance: number; place: NearbyPlace }
  | { kind: 'stop'; key: string; distance: number; stop: NearbyStop };

/** Lots and stops in one list, nearest first; at equal distance, in a fixed order. */
export function mergeNearby(places: NearbyPlace[], stops: NearbyStop[], limit = Infinity): NearbyItem[] {
  const items: NearbyItem[] = [
    ...places.map((place) => ({ kind: 'place' as const, key: `place:${place.id}`, distance: place.distance, place })),
    ...stops.map((stop) => ({ kind: 'stop' as const, key: `stop:${stop.id}`, distance: stop.distance, stop })),
  ];
  return items.sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key)).slice(0, limit);
}
