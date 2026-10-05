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
]);

export function isGreening(suggestionId: string): boolean {
  return GREENING_SUGGESTIONS.has(suggestionId);
}
