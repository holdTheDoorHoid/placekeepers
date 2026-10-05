// Zoomed out, the map draws only a sample of the vacant parcels (docs/CONTRACTS.md section 4, issue
// #26): below zoom 13 the lots tiles hold one point for some of the parcels, marked `lo`, so the
// whole city stays light on a phone. Counts, lists, the plot and downloads are built from what the
// map draws, so below that zoom they would quietly describe a sample as if it were everything. The
// views check here first and ask people to zoom in instead.

/** From this zoom up, the lots tiles hold every parcel with its shape and every property. */
export const LOTS_DETAIL_ZOOM = 13;

/** True for a parcel drawn from the light zoomed out sample. */
export function isSampleFeature(properties: Record<string, unknown>): boolean {
  return properties.lo === 1 || properties.lo === '1' || properties.lo === true;
}

/**
 * True when the parcels drawn in view are only a sample of the parcels there: the map is zoomed
 * out below LOTS_DETAIL_ZOOM, or some parcel in view comes from the sample (the map can still show
 * the zoomed out tiles for a moment after zooming in, while the detailed ones load).
 */
export function isSample(zoom: number, places: readonly { properties: Record<string, unknown> }[]): boolean {
  return zoom < LOTS_DETAIL_ZOOM || places.some((place) => isSampleFeature(place.properties));
}
