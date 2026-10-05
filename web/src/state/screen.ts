// The view that suits this browser's screen right now (src/state/defaults.ts, autoView).

import type { ViewName } from '../registry/types.ts';
import { FIELD_VIEW_MAX_HEIGHT, FIELD_VIEW_MAX_WIDTH, autoView } from './defaults.ts';

/** A touch screen, such as a phone or a tablet. */
export const TOUCH_QUERY = '(pointer: coarse)';
/** The screens where the view may change as the screen turns or the window changes size. */
export const VIEW_QUERIES = [`(max-width: ${FIELD_VIEW_MAX_WIDTH - 0.02}px)`, `(max-height: ${FIELD_VIEW_MAX_HEIGHT - 0.02}px)`, TOUCH_QUERY];

export function screenView(): ViewName {
  return autoView(window.innerWidth, window.innerHeight, window.matchMedia(TOUCH_QUERY).matches);
}
