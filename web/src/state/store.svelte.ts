// The live app state, shared by every component. Svelte tracks reads and writes of the
// fields marked $state, so the map, the panels and the address bar all follow changes.

import type { Geometry } from 'geojson';
import type { Manifest, ParseResult } from '../data/manifest.ts';
import { buildDossier, type DossierView } from '../dossier/build.ts';
import { fetchParcelsAt } from '../dossier/carto.ts';
import { DossierController } from '../dossier/controller.svelte.ts';
import { isOpaAccount } from '../dossier/opa.ts';
import type { InspectTarget, LayerStatus, MapController, ParcelInView } from '../map/controller.ts';
import type { Registry, SettingValue, ViewName } from '../registry/types.ts';
import { strings } from '../strings.ts';
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
import { LIVE_CITY_DATA, saveOptions, type OptionValues } from './options.ts';
import { PREFS_KEY, removeItem } from './storage.ts';

/** Below this zoom a tap on the map is too coarse to mean one parcel. */
export const PICK_MIN_ZOOM = 16;

export interface SelectHints {
  /** A point on the parcel, such as where it was tapped. */
  center?: [number, number] | null;
  /** The parcel's shape, when a lookup found it. */
  shape?: Geometry | null;
  /** Open the lot page (the default), or only mark the parcel on the map. */
  open?: boolean;
}

export interface StoreDeps {
  /** Where the published data lives. */
  dataBase?: string;
  /** The app wide options saved in this browser. */
  options?: OptionValues;
  fetchImpl?: typeof fetch;
}

export class AppStore {
  readonly registry: Registry;
  state: AppState;
  /** The view stays put instead of following the screen width (a link or the person chose it). */
  viewPinned: boolean;
  /** The person chose the view themselves; only then is it saved in this browser. */
  viewChosen: boolean;
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
  /** A memorial, crash or street block someone tapped, shown in the details panel. */
  inspected = $state.raw<InspectTarget | null>(null);
  /** Short messages read out by screen readers and shown briefly on screen. */
  message = $state('');

  /** App wide options (registry/options.yaml), kept only in this browser. */
  options: OptionValues;
  /** The open lot page. */
  readonly dossier: DossierController;
  /** The lot page is showing (in the field view, the full screen sheet). */
  dossierOpen = $state(false);
  /** A tap on the map is being looked up with the City. */
  picking = $state(false);
  /** Fly to the selected parcel as soon as its place is known (after a search by parcel number). */
  flyToSelection = $state(false);
  /** Everything the open lot page shows, rebuilt as answers arrive (src/dossier/build.ts). */
  readonly dossierView: DossierView | null = $derived.by(() => {
    const opa = this.dossier.opa;
    if (!opa) return null;
    return buildDossier({
      opa,
      registry: this.registry,
      state: this.state,
      manifest: this.manifest,
      shard: this.dossier.shard,
      tile: this.dossier.tile,
      live: this.dossier.live,
      liveOn: this.liveCityData,
      center: this.dossier.center,
      now: new Date(),
    });
  });

  private resolveManifest: () => void = () => {};
  /** Settles once the manifest has loaded or failed. */
  readonly manifestReady: Promise<void>;
  private pickRun = 0;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(registry: Registry, initial: { state: AppState; viewPinned: boolean; from?: string }, deps: StoreDeps = {}) {
    this.registry = registry;
    this.state = $state(initial.state);
    this.viewPinned = $state(initial.viewPinned);
    this.viewChosen = $state(initial.viewPinned && initial.from === 'saved');
    this.options = $state(deps.options ?? Object.fromEntries(registry.options.map((o) => [o.id, o.default])));
    this.manifestReady = new Promise<void>((resolve) => (this.resolveManifest = resolve));
    this.fetchImpl = deps.fetchImpl;
    this.dossier = new DossierController({
      dataBase: deps.dataBase ?? './data/',
      files: () => this.manifestReady.then(() => (this.manifest ? this.manifest.files : null)),
      liveOn: () => this.liveCityData,
      fetchImpl: deps.fetchImpl,
    });
    this.dossierOpen = initial.state.selected !== null;
  }

  /** Whether the browser may ask the City's servers for live data. */
  get liveCityData(): boolean {
    return this.options[LIVE_CITY_DATA] !== false;
  }

  setManifest(result: Pick<ParseResult, 'manifest' | 'error'>): void {
    this.manifest = result.manifest;
    this.manifestError = result.error;
    this.manifestLoaded = true;
    this.resolveManifest();
  }

  /** Changes an app wide option and saves it in this browser only. */
  setOption(id: string, value: SettingValue): void {
    if (!this.registry.options.some((o) => o.id === id)) return;
    this.options[id] = value;
    saveOptions(this.registry, $state.snapshot(this.options));
    if (id === LIVE_CITY_DATA) this.dossier.liveChanged();
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
      this.viewChosen = true;
      this.touch();
    }
  }

  unpinView(view: ViewName): void {
    this.viewPinned = false;
    this.viewChosen = false;
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

  /**
   * Selects a parcel (or clears the selection) and opens its lot page. Any parcel in the city
   * can be selected by its OPA account; `properties` are its tile properties when it is on our
   * list and was tapped on the map.
   */
  select(id: string | null, properties: Record<string, unknown> | null = null, hints: SelectHints = {}): void {
    this.state.selected = id;
    this.selectedProperties = properties;
    this.dossierOpen = id !== null && hints.open !== false;
    if (id) this.inspected = null;
    if (id && isOpaAccount(id)) this.dossier.open(id, { tile: properties, center: hints.center ?? null, shape: hints.shape ?? null });
    else this.dossier.close();
  }

  /**
   * A tap on the map that hit nothing on our layers: close in, ask the City's parcel map which
   * parcel is there and open its lot page. Farther out, or with live City data off, it only
   * clears the selection.
   */
  async pickAt(lngLat: [number, number]): Promise<void> {
    const run = ++this.pickRun;
    if (this.state.map.zoom < PICK_MIN_ZOOM) {
      this.select(null);
      return;
    }
    if (!this.liveCityData) {
      this.select(null);
      this.say(strings.pick.liveOff);
      return;
    }
    this.picking = true;
    const result = await fetchParcelsAt(lngLat[0], lngLat[1], { fetchImpl: this.fetchImpl }).catch(() => null);
    if (run !== this.pickRun) return;
    this.picking = false;
    if (!result) {
      this.select(null);
      return;
    }
    if (!result.ok) {
      this.say(strings.pick.failed(strings.failure[result.reason] ?? strings.failure.network!));
      return;
    }
    const parcel = result.data[0];
    if (!parcel) {
      this.select(null);
      this.say(strings.pick.nothing);
      return;
    }
    this.select(parcel.opa, null, { center: lngLat, shape: parcel.shape });
  }

  /** Shows a tapped memorial, crash or street block, or clears it. A parcel selection gives way. */
  inspect(target: InspectTarget | null): void {
    this.inspected = target && target.features.length ? target : null;
    if (this.inspected) this.select(null);
  }

  /** Replaces everything at once, for a link pasted into an open tab. */
  replace(state: AppState, viewPinned: boolean): void {
    this.state = state;
    this.viewPinned = viewPinned;
    this.selectedProperties = null;
    this.dossierOpen = state.selected !== null;
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
