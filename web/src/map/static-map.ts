// A small map drawn once as a picture, for pages meant for paper (M5.1 packets, M5.2 flyers): the
// base map around some places, with each place's number drawn on top by the page itself. MapLibre
// draws it off screen and hands back a picture, so it prints the same in every browser, and the
// map is then thrown away. Loaded on demand, like the main map.
//
// When the map cannot be drawn (no graphics support, or no base map in this build), the page still
// gets where each place falls, worked out here, and draws the numbers on a plain frame.

import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapMode } from './basemap-mode.ts';

export interface StaticPoint {
  lng: number;
  lat: number;
  label: string;
}

export interface StaticMark {
  /** Where the place falls, in CSS pixels from the picture's top left corner. */
  x: number;
  y: number;
  label: string;
}

export interface StaticMap {
  /** The picture as a data address (PNG), or null when the map could not be drawn. */
  image: string | null;
  marks: StaticMark[];
  /** The base map's credit, when the picture shows it. */
  credit: boolean;
  width: number;
  height: number;
}

export interface StaticMapOptions {
  dataBase: string;
  mode: BasemapMode;
  points: StaticPoint[];
  width: number;
  height: number;
  /** The closest the map zooms in, for one place or places close together. */
  maxZoom?: number;
  /** Space kept around the places, in pixels. */
  padding?: number;
  /** How long to wait for the base map before giving up (milliseconds). */
  timeoutMs?: number;
}

const TILE = 512;

/** One PMTiles protocol for the page, shared by every small map on it (a half page flyer draws two at once). */
let sharedProtocol: import('pmtiles').Protocol | null = null;

function mercatorX(lng: number): number {
  return (lng + 180) / 360;
}

function mercatorY(lat: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

/**
 * Where each place falls in a frame of the given size, by the same Web Mercator projection the map
 * uses, fitted with padding (for the plain frame drawn without a map).
 */
export function fitMarks(points: StaticPoint[], width: number, height: number, padding = 24, maxZoom = 17): StaticMark[] {
  if (points.length === 0) return [];
  const xs = points.map((p) => mercatorX(p.lng));
  const ys = points.map((p) => mercatorY(p.lat));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const innerW = Math.max(1, width - 2 * padding);
  const innerH = Math.max(1, height - 2 * padding);
  const maxScale = TILE * 2 ** maxZoom;
  const scale = Math.min(maxScale, x1 > x0 ? innerW / (x1 - x0) : maxScale, y1 > y0 ? innerH / (y1 - y0) : maxScale);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return points.map((p, i) => ({
    x: Math.round((width / 2 + (xs[i]! - cx) * scale) * 10) / 10,
    y: Math.round((height / 2 + (ys[i]! - cy) * scale) * 10) / 10,
    label: p.label,
  }));
}

/** Draws the map off screen and returns its picture with where each place falls. */
export async function renderStaticMap(options: StaticMapOptions): Promise<StaticMap> {
  const { points, width, height } = options;
  const padding = options.padding ?? 28;
  const maxZoom = options.maxZoom ?? 16;
  const fallback: StaticMap = { image: null, marks: fitMarks(points, width, height, padding, maxZoom), credit: false, width, height };
  if (points.length === 0 || typeof document === 'undefined') return fallback;
  let container: HTMLDivElement | null = null;
  try {
    const [{ default: maplibregl }, { Protocol }, basemap, { registerArchive, styleArchives }] = await Promise.all([
      import('maplibre-gl'),
      import('pmtiles'),
      import('./basemap.ts'),
      import('./pmtiles-source.ts'),
    ]);
    const choice = await basemap.chooseBasemap(options.mode, options.dataBase);
    const style = choice.style;
    if (!sharedProtocol) {
      sharedProtocol = new Protocol({ metadata: false });
      maplibregl.addProtocol('pmtiles', sharedProtocol.tile);
    }
    for (const url of styleArchives(style)) registerArchive(sharedProtocol, url);

    container = document.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    Object.assign(container.style, { position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, height: `${height}px` });
    document.body.appendChild(container);
    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    const map = new maplibregl.Map({
      container,
      style: style as StyleSpecification | string,
      interactive: false,
      attributionControl: false,
      pixelRatio: 2,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      bounds: [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      fitBoundsOptions: { padding, maxZoom },
    } as ConstructorParameters<typeof maplibregl.Map>[0]);
    const drawn = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), options.timeoutMs ?? 15000);
      map.once('idle', () => {
        clearTimeout(timer);
        resolve(true);
      });
      map.once('error', () => undefined);
    });
    let image: string | null = null;
    if (drawn) {
      try {
        image = map.getCanvas().toDataURL('image/png');
      } catch {
        image = null;
      }
    }
    const marks = points.map((p) => {
      const at = map.project([p.lng, p.lat]);
      return { x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, label: p.label };
    });
    map.remove();
    return { image, marks, credit: image !== null && basemap.isProtomaps(style), width, height };
  } catch {
    return fallback;
  } finally {
    container?.remove();
  }
}
