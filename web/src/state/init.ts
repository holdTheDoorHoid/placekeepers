// Where the state comes from when the page opens, and what is remembered between visits.
//
// 1. A link: if the address has state after "#", it wins, so a shared link shows exactly
//    what the sender saw.
// 2. Saved settings: otherwise, the settings this browser saved last time.
// 3. Defaults: otherwise, the registry defaults for the view that suits the screen.

import type { Registry } from '../registry/types.ts';
import { autoView, defaultState, type AppState } from './defaults.ts';
import { decodeState, encodeState } from './url.ts';

export interface InitialState {
  state: AppState;
  /** True when a view was chosen (in the link, in saved settings), not picked by screen size. */
  viewPinned: boolean;
  from: 'link' | 'saved' | 'defaults';
}

export function initialState(
  reg: Registry,
  input: { hash: string; width: number; height?: number; touch?: boolean; saved: string | null },
): InitialState {
  const auto = autoView(input.width, input.height, input.touch);
  const link = decodeState(reg, input.hash, auto);
  if (link.found) return { state: link.state, viewPinned: link.hasView, from: 'link' };
  if (input.saved) {
    const saved = decodeState(reg, input.saved, auto);
    if (saved.found) return { state: saved.state, viewPinned: saved.hasView, from: 'saved' };
  }
  return { state: defaultState(reg, auto), viewPinned: false, from: 'defaults' };
}

/**
 * The text saved in browser storage: only what differs from the defaults, without the map
 * position or selection (those stay in the link). Null means nothing needs saving.
 */
export function savedText(reg: Registry, state: AppState, viewPinned: boolean): string | null {
  const text = encodeState(reg, state, {
    includeView: viewPinned,
    includeMap: false,
    includeSelection: false,
    layers: 'ifChanged',
  });
  return text === '' ? null : text;
}
