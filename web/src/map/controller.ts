// Drives the MapLibre map from the app state. Svelte owns the state; this class makes the
// map match it. A layer's data is added the first time the layer is switched on, never
// before. After that, only what changed is sent to the map (a paint property, a filter, or
// the visibility), so moving a lens slider is a single paint update and reloads nothing.
// Camera moves made by the person flow back to the state through events.move.
// This module is loaded on demand, which keeps MapLibre out of the first download.

import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl, {
  type FilterSpecification,
  type LayerSpecification,
  type Map as MapLibreMap,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import type { Geometry } from 'geojson';
import { Protocol } from 'pmtiles';
import { resolveLayerData, type LayerData, type Manifest } from '../data/manifest.ts';
import { basemapCredit, isProtomaps } from './basemap.ts';
import { NO_PADDING, type Padding } from './covered.ts';
import { registerArchive, styleArchives } from './pmtiles-source.ts';
import type { Layer, Registry, ViewName } from '../registry/types.ts';
import type { AppState, MapPosition } from '../state/defaults.ts';
import { strings } from '../strings.ts';
import { basemapLook, restyleBase } from './styles/basemap.ts';
import { SELECTED, SELECTED_CASING } from './styles/palette.ts';
import { STYLES, partId, styleFor, type StyleModule } from './styles/index.ts';

/** The outline of a parcel opened by a lookup (not from the lots layer), drawn above everything. */
const PICKED_SOURCE = 'pk-picked-parcel';
const PICKED_LAYERS = ['pk-picked-parcel:casing', 'pk-picked-parcel:line'];

/** The map may wander a little beyond the city, but not far. */
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-75.75, 39.65],
  [-74.55, 40.35],
];

let protocol: Protocol | null = null;
function pmtilesProtocol(): Protocol {
  if (!protocol) {
    protocol = new Protocol({ metadata: false });
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

export type LayerStatus = 'ok' | 'unavailable' | 'error';

export interface ParcelInView {
  id: string;
  properties: Record<string, unknown>;
  center: [number, number];
}

/** A memorial, crash or street block someone tapped: shown in the details panel. */
export interface InspectTarget {
  layerId: string;
  /** Properties of the features of that layer under the pointer, top first, without repeats. */
  features: Record<string, unknown>[];
  lngLat: [number, number];
}

export interface MapEvents {
  move(position: MapPosition): void;
  /** A tap on a parcel of the lots layer, with where it was tapped. */
  select(id: string | null, properties: Record<string, unknown> | null, lngLat?: [number, number]): void;
  /** A tap that hit nothing on the data layers: the app may look up the parcel there. */
  pick?(lngLat: [number, number]): void;
  /** A tap on a memorial, crash or street block, or null when nothing of the kind was tapped. */
  inspect(target: InspectTarget | null): void;
  /** The map finished drawing after a move or a data change. */
  idle(): void;
  /** The map has drawn for the first time, with its data layers. */
  ready?(): void;
  layerStatus(layerId: string, status: LayerStatus): void;
}

export interface ControllerOptions {
  container: HTMLElement;
  registry: Registry;
  dataBase: string;
  style: StyleSpecification | string;
  state: AppState;
  manifest: Manifest | null;
  events: MapEvents;
  /** The site root, for the link to the Data status page in the credits line. */
  siteBase?: string;
  /**
   * How much of the map the page covers now (src/map/covered.ts), or null when nothing useful is
   * left uncovered. The map flies with it as padding, so places land where people can see them.
   */
  padding?: () => Padding | null;
}

interface Applied {
  style: StyleModule;
  sourceId: string;
  sourceLayer: string | null;
  specs: LayerSpecification[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Where the credits line sits: clear of the field view's bottom sheet and the map's buttons. */
function creditsPosition(view: ViewName): 'top-left' | 'bottom-right' {
  return view === 'field' ? 'top-left' : 'bottom-right';
}

function centerOf(geometry: Geometry): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      const [x, y] = coords as [number, number];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    } else if (Array.isArray(coords)) coords.forEach(visit);
  };
  if ('coordinates' in geometry) visit(geometry.coordinates);
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export class MapController {
  readonly map: MapLibreMap;
  private readonly registry: Registry;
  private readonly dataBase: string;
  private readonly events: MapEvents;
  private manifest: Manifest | null;
  private state: AppState;
  private readonly applied = new Map<string, Applied>();
  private readonly reported = new Map<string, LayerStatus>();
  private loaded = false;
  private labelAnchor: string | undefined;
  private marker: maplibregl.Marker | null = null;
  /** The features someone opened, drawn as selected by their layer's style. */
  private inspected: { layerId: string; ids: (string | number)[] } | null = null;
  /** The outline of a parcel opened by a lookup, waiting for the map to load. */
  private pickedShape: Geometry | null = null;
  /** The base map's own layers as the starting style drew them, before any restyling. */
  private baseStart: LayerSpecification[] | null = null;
  /** The base layers as they are drawn now. */
  private baseApplied: LayerSpecification[] = [];
  private readonly protomaps: boolean;
  private credits: maplibregl.AttributionControl;
  private creditsAt: 'top-left' | 'bottom-right';
  private readyFired = false;
  /** The look and visibility the base layers are drawn with now (see baseKey). */
  private baseDrawn = '';
  private readonly padding: () => Padding | null;
  /** A camera move waiting for the next frame, when panels have opened or closed. */
  private pendingMove: { center: [number, number]; zoom: number | null; animate: boolean } | null = null;
  private moveFrame = 0;

  constructor(options: ControllerOptions) {
    for (const url of styleArchives(options.style)) registerArchive(pmtilesProtocol(), url);
    this.registry = options.registry;
    this.dataBase = options.dataBase;
    this.events = options.events;
    this.manifest = options.manifest;
    this.state = options.state;
    this.protomaps = isProtomaps(options.style);
    this.padding = options.padding ?? (() => NO_PADDING);
    let style = options.style;
    if (typeof style !== 'string') {
      // The base map starts in the look and visibility the state asks for, with no flash of the
      // default look; it keeps every layer of the light look so another look can be chosen later.
      this.baseStart = style.layers;
      this.baseApplied = this.baseTarget();
      style = { ...style, layers: this.baseApplied };
    }
    const { lng, lat, zoom, bearing, pitch } = options.state.map;
    this.map = new maplibregl.Map({
      container: options.container,
      style,
      center: [lng, lat],
      zoom,
      bearing,
      pitch,
      minZoom: 9,
      maxZoom: 19,
      maxBounds: MAX_BOUNDS,
      attributionControl: false,
      localIdeographFontFamily: 'sans-serif',
    });
    // One short credits line, always open: the base map's credit, which OpenStreetMap's license
    // asks to stay visible, and "Data: City of Philadelphia and others" linking to the Data status
    // page, which lists every source with its license (as each layer's "About this layer" does).
    // The full list of sources no longer sits on the map, where it covered a third of it.
    const credits = [basemapCredit(options.style), strings.credits.data(`${options.siteBase ?? './'}status/`)];
    this.credits = new maplibregl.AttributionControl({ compact: false, customAttribution: credits.filter((c): c is string => c !== null) });
    this.creditsAt = creditsPosition(options.state.view);
    this.map.addControl(this.credits, this.creditsAt);
    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    this.map.getCanvas().setAttribute('aria-label', strings.app.mapLabel);

    this.map.on('load', () => {
      this.loaded = true;
      const layers = this.map.getStyle().layers;
      // A hosted style (OpenFreeMap) brings its own layers, known only now, drawn as it styles them.
      if (!this.baseStart) {
        this.baseApplied = this.baseStart = layers;
        this.baseDrawn = 'light:true';
      }
      this.labelAnchor = layers.find((l) => l.type === 'symbol')?.id;
      this.sync();
      this.drawPickedShape();
    });
    this.map.on('moveend', () => this.events.move(this.position()));
    this.map.on('idle', () => {
      if (this.loaded && !this.readyFired) {
        this.readyFired = true;
        this.events.ready?.();
      }
      this.events.idle();
    });
    this.map.on('click', (e) => this.handleClick(e));
    this.map.on('mousemove', (e) => this.handleHover(e));
    this.map.on('error', (e) => this.handleError(e as unknown as { sourceId?: string; error?: Error }));
  }

  setState(state: AppState): void {
    this.state = state;
    this.sync();
  }

  /** Draws the memorial, crash or street block someone opened as selected, or clears it. */
  setInspected(target: InspectTarget | null): void {
    const before = this.inspected?.layerId;
    const ids = (target?.features ?? [])
      .map((f) => f.id)
      .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number');
    this.inspected = target && ids.length ? { layerId: target.layerId, ids } : null;
    if (!this.loaded) return;
    if (before) this.syncLayer(before);
    if (this.inspected && this.inspected.layerId !== before) this.syncLayer(this.inspected.layerId);
  }

  /** Outlines a parcel that was opened by a lookup rather than from the lots layer, or clears it. */
  setSelectedShape(shape: Geometry | null): void {
    if (shape === this.pickedShape) return;
    this.pickedShape = shape;
    this.drawPickedShape();
  }

  private drawPickedShape(): void {
    if (!this.loaded) return;
    const data = { type: 'FeatureCollection' as const, features: this.pickedShape ? [{ type: 'Feature' as const, properties: {}, geometry: this.pickedShape }] : [] };
    const source = this.map.getSource(PICKED_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    if (!this.pickedShape) return;
    this.map.addSource(PICKED_SOURCE, { type: 'geojson', data });
    this.map.addLayer({
      id: PICKED_LAYERS[0]!,
      type: 'line',
      source: PICKED_SOURCE,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': SELECTED_CASING, 'line-width': 7 },
    });
    this.map.addLayer({
      id: PICKED_LAYERS[1]!,
      type: 'line',
      source: PICKED_SOURCE,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': SELECTED, 'line-width': 3.5 },
    });
  }

  setManifest(manifest: Manifest | null): void {
    if (manifest === this.manifest) return;
    this.manifest = manifest;
    this.sync();
  }

  destroy(): void {
    cancelAnimationFrame(this.moveFrame);
    this.map.remove();
  }

  position(): MapPosition {
    const c = this.map.getCenter();
    return { lng: c.lng, lat: c.lat, zoom: this.map.getZoom(), bearing: this.map.getBearing(), pitch: this.map.getPitch() };
  }

  /** Parcels drawn in the current view, one entry per parcel. */
  parcelsInView(): ParcelInView[] {
    const ids = this.parts((style) => style === STYLES.vacant_parcels, 'clickable');
    if (!this.loaded || ids.length === 0) return [];
    const seen = new Map<string, ParcelInView>();
    for (const feature of this.map.queryRenderedFeatures({ layers: ids })) {
      const id = feature.properties?.id;
      if (id === undefined || id === null || seen.has(String(id))) continue;
      seen.set(String(id), { id: String(id), properties: { ...feature.properties }, center: centerOf(feature.geometry) });
    }
    return [...seen.values()];
  }

  /** A parcel in loaded data, with a point on it, for a selection that came from a link. */
  findParcel(id: string): { properties: Record<string, unknown>; center: [number, number] } | null {
    if (!this.loaded) return null;
    for (const applied of this.applied.values()) {
      if (applied.style !== STYLES.vacant_parcels) continue;
      const features = this.map.querySourceFeatures(applied.sourceId, {
        sourceLayer: applied.sourceLayer ?? undefined,
        filter: ['==', ['to-string', ['get', 'id']], id] as FilterSpecification,
      });
      if (features[0]) return { properties: { ...features[0].properties }, center: centerOf(features[0].geometry) };
    }
    return null;
  }

  /** How much of the map the page covers now, or null when nothing useful is left uncovered. */
  coverPadding(): Padding | null {
    return this.padding();
  }

  /**
   * Flies to a place, zooming in to at least `zoom`, and lands it in the middle of the part of the
   * map people can see: the move waits for the next frame, so a panel that opens or closes with the
   * same tap is already in place, and flies with that panel or sheet as MapLibre's padding.
   */
  flyTo(center: [number, number], zoom = 17): void {
    this.queueMove({ center, zoom, animate: true });
  }

  /** Brings a place to the middle of the visible part of the map without zooming, as a link opens. */
  showPlace(center: [number, number], animate = false): void {
    this.queueMove({ center, zoom: null, animate });
  }

  private queueMove(move: { center: [number, number]; zoom: number | null; animate: boolean }): void {
    this.pendingMove = move;
    if (this.moveFrame) return;
    this.moveFrame = requestAnimationFrame(() => {
      this.moveFrame = 0;
      const next = this.pendingMove;
      this.pendingMove = null;
      if (!next) return;
      const padding = this.padding() ?? NO_PADDING;
      const zoom = next.zoom === null ? this.map.getZoom() : Math.max(this.map.getZoom(), next.zoom);
      // Not essential, so MapLibre skips the animation for people who prefer reduced motion.
      if (next.animate) this.map.flyTo({ center: next.center, zoom, padding, essential: false });
      else this.map.easeTo({ center: next.center, zoom, padding, duration: 0 });
    });
  }

  showUserLocation(lng: number, lat: number): void {
    if (!this.marker) {
      const dot = document.createElement('div');
      dot.className = 'pk-you-are-here';
      dot.setAttribute('role', 'img');
      dot.setAttribute('aria-label', strings.field.youAreHere);
      this.marker = new maplibregl.Marker({ element: dot });
    }
    this.marker.setLngLat([lng, lat]).addTo(this.map);
    this.queueMove({ center: [lng, lat], zoom: 16, animate: true });
  }

  /** Takes the "you are here" dot off the map. */
  hideUserLocation(): void {
    this.marker?.remove();
  }

  /** The view as west, south, east and north. */
  bounds(): [number, number, number, number] {
    const b = this.map.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  }

  // Keeping the map in step with the state ------------------------------------------------

  private sync(): void {
    if (!this.loaded) return;
    this.syncCamera();
    this.syncCredits();
    for (const layer of this.registry.layers) this.syncLayer(layer.id);
  }

  private syncCredits(): void {
    const at = creditsPosition(this.state.view);
    if (at === this.creditsAt) return;
    this.map.removeControl(this.credits);
    this.map.addControl(this.credits, at);
    this.creditsAt = at;
  }

  // The base map ------------------------------------------------------------------------------

  /** The base map's registry layer (style `basemap`), if the registry has one. */
  private baseLayer(): Layer | undefined {
    return this.registry.layers.find((l) => styleFor(l)?.base);
  }

  /** The look and visibility the state asks of the base map, as a short key. */
  private baseKey(): string {
    const layer = this.baseLayer();
    if (!layer) return 'none';
    return `${basemapLook({ layer, registry: this.registry, state: this.state })}:${this.state.layers.includes(layer.id)}`;
  }

  /** The base layers as the state wants them drawn. */
  private baseTarget(): LayerSpecification[] {
    const layer = this.baseLayer();
    if (!this.baseStart) return [];
    this.baseDrawn = this.baseKey();
    if (!layer) return this.baseStart;
    const visible = this.state.layers.includes(layer.id);
    const look = basemapLook({ layer, registry: this.registry, state: this.state });
    return restyleBase(this.baseStart, look, visible, this.protomaps);
  }

  private syncBase(layer: Layer): void {
    if (!this.baseStart) return;
    // Without the extract (a plain background) there is no base map to show or restyle.
    this.report(layer.id, this.baseStart.some((l) => l.type !== 'background') ? 'ok' : 'unavailable');
    if (this.baseKey() === this.baseDrawn) return;
    const next = this.baseTarget();
    next.forEach((spec, i) => {
      const prev = this.baseApplied[i];
      if (prev?.id === spec.id) this.updateLayer(prev, spec);
    });
    this.baseApplied = next;
  }

  private syncCamera(): void {
    if (this.map.isMoving()) return;
    const want = this.state.map;
    const now = this.position();
    const moved =
      Math.abs(now.lng - want.lng) > 1e-6 ||
      Math.abs(now.lat - want.lat) > 1e-6 ||
      Math.abs(now.zoom - want.zoom) > 1e-3 ||
      Math.abs(now.bearing - want.bearing) > 1e-2 ||
      Math.abs(now.pitch - want.pitch) > 1e-2;
    if (moved) this.map.jumpTo({ center: [want.lng, want.lat], zoom: want.zoom, bearing: want.bearing, pitch: want.pitch });
  }

  private report(layerId: string, status: LayerStatus): void {
    if (this.reported.get(layerId) === status) return;
    this.reported.set(layerId, status);
    this.events.layerStatus(layerId, status);
  }

  private syncLayer(layerId: string): void {
    const layer = this.registry.layers.find((l) => l.id === layerId);
    const style = layer && styleFor(layer);
    if (!layer || !style) return;
    if (style.base) {
      this.syncBase(layer);
      return;
    }
    const visible = this.state.layers.includes(layerId);
    const applied = this.applied.get(layerId);

    if (!applied) {
      if (!visible) return;
      const resolved = resolveLayerData(layer, this.manifest, this.dataBase);
      if (!resolved.ok) {
        this.report(layerId, 'unavailable');
        return;
      }
      const sourceId = this.ensureSource(resolved.data);
      const specs = this.withVisibility(
        style.layers({
          layer,
          registry: this.registry,
          state: this.state,
          sourceId,
          sourceLayer: resolved.data.sourceLayer,
          glyphs: this.hasGlyphs(),
          highlight: this.highlightFor(layerId),
        }),
        true,
      );
      const before = this.beforeId(style.zIndex);
      for (const spec of specs) this.map.addLayer(spec, before);
      this.applied.set(layerId, { style, sourceId, sourceLayer: resolved.data.sourceLayer, specs });
      this.report(layerId, 'ok');
      return;
    }

    const next = this.withVisibility(
      style.layers({
        layer,
        registry: this.registry,
        state: this.state,
        sourceId: applied.sourceId,
        sourceLayer: applied.sourceLayer,
        glyphs: this.hasGlyphs(),
        highlight: this.highlightFor(layerId),
      }),
      visible,
    );
    next.forEach((spec, i) => {
      const prev = applied.specs[i];
      if (prev?.id === spec.id) this.updateLayer(prev, spec);
    });
    applied.specs = next;
  }

  private highlightFor(layerId: string): (string | number)[] {
    return this.inspected?.layerId === layerId ? this.inspected.ids : [];
  }

  private withVisibility(specs: LayerSpecification[], visible: boolean): LayerSpecification[] {
    return specs.map((spec) => ({ ...spec, layout: { ...(spec.layout ?? {}), visibility: visible ? 'visible' : 'none' } }) as LayerSpecification);
  }

  private updateLayer(prev: LayerSpecification, next: LayerSpecification): void {
    const id = next.id;
    const prevPaint = ('paint' in prev ? prev.paint : undefined) ?? {};
    const nextPaint = ('paint' in next ? next.paint : undefined) ?? {};
    for (const key of new Set([...Object.keys(prevPaint), ...Object.keys(nextPaint)])) {
      const value = (nextPaint as Record<string, unknown>)[key];
      if (!same((prevPaint as Record<string, unknown>)[key], value)) this.map.setPaintProperty(id, key, value);
    }
    const prevLayout = prev.layout ?? {};
    const nextLayout = next.layout ?? {};
    for (const key of new Set([...Object.keys(prevLayout), ...Object.keys(nextLayout)])) {
      const value = (nextLayout as Record<string, unknown>)[key];
      if (!same((prevLayout as Record<string, unknown>)[key], value)) this.map.setLayoutProperty(id, key, value);
    }
    const prevFilter = 'filter' in prev ? prev.filter : undefined;
    const nextFilter = 'filter' in next ? next.filter : undefined;
    if (!same(prevFilter, nextFilter)) this.map.setFilter(id, nextFilter ?? null);
  }

  /** Data layers sit under the base map's labels, ordered by their style's zIndex. */
  /** Whether the base map brought label fonts; without them no text layer may be added. */
  private hasGlyphs(): boolean {
    return Boolean(this.map.getStyle()?.glyphs);
  }

  private beforeId(zIndex: number): string | undefined {
    let best: { z: number; id: string } | null = null;
    for (const applied of this.applied.values()) {
      const first = applied.specs[0];
      if (first && applied.style.zIndex > zIndex && (!best || applied.style.zIndex < best.z)) {
        best = { z: applied.style.zIndex, id: first.id };
      }
    }
    return best?.id ?? this.labelAnchor;
  }

  /** Adds a data file as a map source. Its credits are in the credits line, not on the source. */
  private ensureSource(data: LayerData): string {
    const sourceId = `pk-src:${data.path}`;
    if (this.map.getSource(sourceId)) return sourceId;
    if (data.kind === 'pmtiles') {
      registerArchive(pmtilesProtocol(), data.url);
      this.map.addSource(sourceId, { type: 'vector', url: `pmtiles://${data.url}` });
    } else {
      this.map.addSource(sourceId, { type: 'geojson', data: data.url });
    }
    return sourceId;
  }

  // Pointer handling ------------------------------------------------------------------------

  private parts(match: (style: StyleModule) => boolean, which: 'clickable'): string[] {
    const ids: string[] = [];
    for (const [layerId, applied] of this.applied) {
      if (!this.state.layers.includes(layerId) || !match(applied.style)) continue;
      for (const part of applied.style[which]) ids.push(partId(layerId, part));
    }
    return ids;
  }

  private hitsAt(point: { x: number; y: number }) {
    const ids = this.parts(() => true, 'clickable');
    if (ids.length === 0) return [];
    // A small box rather than a single pixel, so a fingertip can hit a narrow lot.
    const box: [[number, number], [number, number]] = [
      [point.x - 4, point.y - 4],
      [point.x + 4, point.y + 4],
    ];
    return this.map.queryRenderedFeatures(box, { layers: ids });
  }

  /** The registry layer id inside a part id such as pk:memorials:marker. */
  private layerOf(part: string): string | null {
    const match = /^pk:(.+):[^:]+$/.exec(part);
    return match ? match[1]! : null;
  }

  private handleClick(e: MapMouseEvent): void {
    const hits = this.hitsAt(e.point);
    const top = hits[0];
    const layerId = top ? this.layerOf(top.layer.id) : null;
    const applied = layerId ? this.applied.get(layerId) : undefined;
    const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    if (!top || !layerId || !applied || applied.style === STYLES.vacant_parcels) {
      this.events.inspect(null);
      const id = top?.properties?.id;
      if (top && id !== undefined && id !== null) this.events.select(String(id), { ...top.properties }, lngLat);
      else if (this.events.pick) this.events.pick(lngLat);
      else this.events.select(null, null);
      return;
    }
    // Memorials, crashes and street blocks open in the details panel; two people remembered at
    // one place are both listed.
    const seen = new Set<string>();
    const features: Record<string, unknown>[] = [];
    for (const hit of hits) {
      if (this.layerOf(hit.layer.id) !== layerId) continue;
      const key = JSON.stringify(hit.properties);
      if (seen.has(key)) continue;
      seen.add(key);
      features.push({ ...hit.properties });
    }
    this.events.inspect({ layerId, features, lngLat: [e.lngLat.lng, e.lngLat.lat] });
  }

  private handleHover(e: MapMouseEvent): void {
    this.map.getCanvas().style.cursor = this.hitsAt(e.point).length ? 'pointer' : '';
  }

  private handleError(e: { sourceId?: string; error?: Error }): void {
    if (e.sourceId) {
      for (const [layerId, applied] of this.applied) if (applied.sourceId === e.sourceId) this.report(layerId, 'error');
    }
    console.warn('Placekeepers map:', e.error?.message ?? e);
  }
}
