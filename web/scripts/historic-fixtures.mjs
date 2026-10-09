// The picture layers of the sample data root (M4.3): the City's aerial photos by year and its
// 1860 atlas. They have no files: the browser loads their tiles straight from the City's servers,
// so the manifest lists each layer with `file: null` (docs/CONTRACTS.md section 3) and each source
// with the result of the pipeline's weekly check, one row per picture service. The tests never
// load these tiles: every request to another server is refused there.

export const HISTORIC_SOURCES = {
  city_aerial_photos: [20, null],
  city_atlas_1860: [1, null],
};

export const HISTORIC_LAYERS = {
  aerial_photos: { file: null, source_layer: null, sources: ['city_aerial_photos'] },
  atlas_1860: { file: null, source_layer: null, sources: ['city_atlas_1860'] },
};
