// Suggestions that green a place, such as clean and green. Until the displacement watch overlay
// exists (a later release), every greening suggestion carries the caution of docs/ETHICS.md word
// for word wherever it is listed: on the nearby cards, the lot page, its print, settings and in
// downloads (docs/VERIFICATION.md, decision D12). A new greening suggestion in
// registry/suggestions.yaml joins this list.

export const GREENING_SUGGESTIONS: ReadonlySet<string> = new Set([
  'clean_and_green',
  // The heat and shade lens (M3.1): planting trees and greening to cool are greening too.
  'plant_shade_trees',
  'cool_green_lot',
  // Shade trees at a bus stop (M2.3) are greening as well.
  'stop_shade_trees',
  // The placemaking lens (M3.4): a place to sit under trees, a garden and art can raise nearby
  // prices as greening does, so they carry the same caution.
  'seating_and_shade',
  'community_garden',
  'art_request',
]);

export function isGreening(suggestionId: string): boolean {
  return GREENING_SUGGESTIONS.has(suggestionId);
}

/**
 * Suggestions that answer a lens (M3.1). When that lens colors the lots, a place lists these first,
 * so its card leads with them: under the heat and shade lens, plant shade trees and green the lot
 * to cool the block.
 */
export const LENS_SUGGESTIONS: Readonly<Record<string, readonly string[]>> = {
  heat: ['plant_shade_trees', 'cool_green_lot'],
  // Under the placemaking lens (M3.4), a place to sit, a garden and art lead; the reports to
  // Philly311 keep their place after the lot's first suggestions.
  placemaking: ['seating_and_shade', 'community_garden', 'art_request'],
};
