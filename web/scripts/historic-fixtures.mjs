// The Then and now layers of the sample data root (M4.3).
//
// The pictures (the aerial photos by year and the 1860 atlas) have no files: the browser loads
// their tiles straight from the City's servers, so the manifest lists each layer with
// `file: null` (docs/CONTRACTS.md section 3) and each source with the result of the pipeline's
// weekly check, one row per picture service. The tests never load these tiles: every request to
// another server is refused there.
//
// The 1937 redlining map (owner, 2026-10-09) is a file of its own, under Mapping Inequality's non
// commercial license, which the manifest names on the file (`license`). Here it is a made up
// sample, five squares over the sample lots, one for each grade and one left ungraded, published
// as GeoJSON, as the pipeline does when it skips a tile file.

export const HISTORIC_SOURCES = {
  city_aerial_photos: [20, null],
  dvrpc_aerial_photos: [2, null],
  usgs_aerial_photos_1999: [1, null],
  city_atlas_1860: [1, null],
  mapping_inequality_1937: [83, null],
};

export const HISTORIC_LAYERS = {
  aerial_photos: { file: null, source_layer: null, sources: ['city_aerial_photos', 'dvrpc_aerial_photos', 'usgs_aerial_photos_1999'] },
  atlas_1860: { file: null, source_layer: null, sources: ['city_atlas_1860'] },
  redlining_1937: { file: 'tiles/redlining.pmtiles', source_layer: 'holc', sources: ['mapping_inequality_1937'] },
};

export const REDLINING_FILE = 'tiles/redlining.holc.geojson';
export const REDLINING_LICENSE = 'cc_by_nc_2_5';

const square = (w, s, e, n) => ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });

/** The sample redlining file: [path, text]. */
export function redliningFixture() {
  const areas = [
    [{ l: 'A1', g: 'A' }, square(-75.162, 39.987, -75.155, 39.992)],
    [{ l: 'B1', g: 'B' }, square(-75.155, 39.987, -75.148, 39.992)],
    [{ l: 'C1', g: 'C' }, square(-75.162, 39.981, -75.155, 39.987)],
    [{ l: 'D1', g: 'D' }, square(-75.155, 39.981, -75.148, 39.987)],
    [{ l: 'Industrial and Commercial' }, square(-75.148, 39.981, -75.144, 39.992)],
  ];
  const features = areas.map(([properties, geometry]) => ({ type: 'Feature', properties, geometry }));
  return [REDLINING_FILE, JSON.stringify({ type: 'FeatureCollection', features }) + '\n'];
}
