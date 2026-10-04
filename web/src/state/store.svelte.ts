// The live app state, shared by every component. Svelte tracks reads and writes of the
// fields marked $state, so the map, the panels and the address bar all follow changes.

import type { Manifest } from '../data/manifest.ts';
import type { LayerStatus, MapController, ParcelInView } from '../map/controller.ts';
import type { Registry, SettingValue, ViewName } from '../registry/types.ts';
import {
  clampWeight,
  defaultFilters,
  defaultLensWeights,
  defaultState,
  layersAfterViewSwitch,
  orderLayers,
  presetWeights,
  type AppState,
  type MapPosition,
} from './defaults.ts';
import { PREFS_KEY, removeItem } from './storage.ts';

export class AppStore {
  readonly registry: Registry;
  state: AppState;
  viewPinned: boolean;
  /** True once the person changes a setting, so a link they merely opened is not saved as theirs. */
  touched = $state(false);

  manifest = $state.raw<Manifest | null>(null);
  manifestError = $state<string | null>(null);
  manifestLoaded = $state(false);
  layerStatus = $state<Record<string, LayerStatus>>({});
  basemapMissing = $state(false);

  controller = $state.raw<MapController | null>(null);
  parcelsInView = $state.raw<ParcelInView[]>([]);
  selectedProperties = $state.raw<Record<string, unknown> | null>(null);
  /** Short messages read out by screen readers and shown briefly on screen. */
  message = $state('');

  constructor(registry: Registry, initial: { state: AppState; viewPinned: boolean }) {
    this.registry = registry;
    this.state = $state(initial.state);
    this.viewPinned = $state(initial.viewPinned);
  }

  private touch(): void {
    this.touched = true;
  }

  say(text: string): void {
    // Clearing first makes screen readers announce the same message twice in a row.
    this.message = '';
    queueMicrotask(() => (this.message = text));
  }

  setView(view: ViewName, byPerson = true): void {
    if (view !== this.state.view) {
      this.state.layers = layersAfterViewSwitch(this.registry, this.state.layers, this.state.view, view);
      this.state.view = view;
    }
    if (byPerson) {
      this.viewPinned = true;
      this.touch();
    }
  }

  unpinView(view: ViewName): void {
    this.viewPinned = false;
    this.setView(view, false);
    this.touch();
  }

  setLayerVisible(id: string, visible: boolean): void {
    const next = new Set(this.state.layers);
    if (visible) next.add(id);
    else next.delete(id);
    this.state.layers = orderLayers(this.registry, next);
    this.touch();
  }

  setLayersVisible(ids: string[], visible: boolean): void {
    const next = new Set(this.state.layers);
    for (const id of ids) {
      if (visible) next.add(id);
      else next.delete(id);
    }
    this.state.layers = orderLayers(this.registry, next);
    this.touch();
  }

  setSetting(layerId: string, settingId: string, value: SettingValue): void {
    (this.state.settings[layerId] ??= {})[settingId] = value;
    this.touch();
  }

  setWeight(lensId: string, factorId: string, weight: number): void {
    (this.state.weights[lensId] ??= {})[factorId] = clampWeight(weight);
    this.touch();
  }

  applyPreset(lensId: string, presetId: string): void {
    const lens = this.registry.lenses.find((l) => l.id === lensId);
    const weights = lens && presetWeights(lens, presetId);
    if (!weights) return;
    this.state.weights[lensId] = weights;
    this.touch();
  }

  resetWeights(lensId: string): void {
    const lens = this.registry.lenses.find((l) => l.id === lensId);
    if (!lens) return;
    this.state.weights[lensId] = defaultLensWeights(lens);
    this.touch();
  }

  setSuggestion(id: string, shown: boolean): void {
    this.state.suggestions[id] = shown;
    this.touch();
  }

  setFilter(id: string, values: string[]): void {
    this.state.filters[id] = values;
    this.touch();
  }

  setMap(position: MapPosition): void {
    this.state.map = position;
  }

  select(id: string | null, properties: Record<string, unknown> | null = null): void {
    this.state.selected = id;
    this.selectedProperties = properties;
  }

  /** Replaces everything at once, for a link pasted into an open tab. */
  replace(state: AppState, viewPinned: boolean): void {
    this.state = state;
    this.viewPinned = viewPinned;
    this.selectedProperties = null;
  }

  /**
   * Back to the registry defaults for the current view, keeping the map where it is, and
   * forgetting the settings saved in this browser.
   */
  resetToDefaults(): void {
    const fresh = defaultState(this.registry, this.state.view, this.state.map);
    fresh.selected = this.state.selected;
    this.state = fresh;
    this.touched = false;
    removeItem(PREFS_KEY);
  }

  clearFilters(): void {
    this.state.filters = defaultFilters();
    this.touch();
  }
}
