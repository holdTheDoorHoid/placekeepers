// TypeScript mirror of the registry contract in docs/CONTRACTS.md, section 1.
// The registry YAML is read at build time (see plugins/registry.ts), validated by
// ./validate.ts, and handed to the app as one typed object.

export const EVIDENCE_LEVELS = ['strong', 'moderate', 'mixed', 'weak', 'not_violence', 'context'] as const;
export type Evidence = (typeof EVIDENCE_LEVELS)[number];

// raster: pictures the browser loads from an `arcgis_tiles` source's own server (M4.3).
export const GEOMETRIES = ['point', 'line', 'polygon', 'raster'] as const;
export type Geometry = (typeof GEOMETRIES)[number];

export const CADENCES = ['daily', 'weekly', 'monthly', 'yearly', 'irregular', 'frozen'] as const;
export type Cadence = (typeof CADENCES)[number];

export const ENDPOINT_KINDS = ['carto', 'arcgis', 'url', 'osm_extract', 'curated', 'sparql', 'arcgis_tiles'] as const;
export type EndpointKind = (typeof ENDPOINT_KINDS)[number];

// json: a reply the source's pipeline adapter asks for with query parameters (pba_laser, issue #37).
export const URL_FORMATS = ['csv', 'geojson', 'parquet', 'zip', 'json'] as const;
export type UrlFormat = (typeof URL_FORMATS)[number];

export const APPLIES_TO = ['parcel', 'segment', 'crash', 'stop', 'cell'] as const;
export type AppliesTo = (typeof APPLIES_TO)[number];

export const SETTING_TYPES = ['toggle', 'choice', 'range'] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

export const ROUTE_STATUSES = ['verified', 'confirm'] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

/** The two layouts that share one map. */
export const VIEWS = ['field', 'analysis'] as const;
export type ViewName = (typeof VIEWS)[number];

export interface Group {
  id: string;
  label: string;
  description: string;
}

export interface License {
  id: string;
  label: string;
  url: string;
  share_alike: boolean;
  /** Non commercial use only (added for the 1937 redlining map): its data stays in its own file. */
  non_commercial?: boolean;
  /**
   * False when the map shows no credit line for sources under it (added for the warming and
   * cooling sites, owner 2026-10-09). The Data status page still lists the source.
   */
  credit?: boolean;
}

/** One picture service of an `arcgis_tiles` source (M4.3): its key (the year) and its name. */
export interface TileService {
  key: string;
  service: string;
}

export interface Endpoint {
  kind: EndpointKind;
  table?: string;
  where?: string;
  service?: string;
  /** arcgis: a feature service unless it says MapServer (M4.6). */
  server?: 'FeatureServer' | 'MapServer';
  layer?: number;
  url?: string;
  format?: UrlFormat;
  path?: string;
  /** osm_extract: the OpenStreetMap tags the pipeline keeps, "key=value" or "key" (M2.2). */
  tags?: string[];
  /** arcgis_tiles: where the pictures are, as west, south, east and north (M4.3). */
  bounds?: [number, number, number, number];
  /** arcgis_tiles: the picture services, in order (M4.3). */
  services?: TileService[];
}

export interface SourceHealth {
  min_rows?: number;
  max_drop_pct?: number;
  newest_field?: string;
  max_age_days?: number;
}

export interface Source {
  id: string;
  name: string;
  publisher: string;
  homepage: string;
  endpoint: Endpoint;
  license: string;
  attribution: string;
  cadence: Cadence;
  health: SourceHealth;
  release: string;
}

export interface ChoiceOption {
  value: string;
  label: string;
}

interface SettingBase {
  id: string;
  label: string;
}

export interface ToggleSetting extends SettingBase {
  type: 'toggle';
  default: boolean;
}

export interface ChoiceSetting extends SettingBase {
  type: 'choice';
  options: ChoiceOption[];
  default: string;
  /** "slider": shown as a slider through the options in order, such as years (M4.3). */
  control?: 'slider';
}

export interface RangeSetting extends SettingBase {
  type: 'range';
  min: number;
  max: number;
  /** Optional in the YAML; the validator fills in 1. */
  step: number;
  default: number;
}

export type LayerSetting = ToggleSetting | ChoiceSetting | RangeSetting;
export type SettingValue = boolean | string | number;

export interface Layer {
  id: string;
  label: string;
  group: string;
  description: string;
  sources: string[];
  /**
   * The file under the data root and the layer inside it. A raster layer has neither in the YAML
   * (its pictures come from its source's own server, M4.3); the validator gives it empty text.
   */
  file: string;
  source_layer: string;
  geometry: Geometry;
  style: string;
  evidence: Evidence;
  default: Record<ViewName, boolean>;
  /** The slug of a content page that shows how anyone can help improve this layer (M2.2). */
  guide?: string;
  settings: LayerSetting[];
  release: string;
}

export interface LensFactor {
  id: string;
  label: string;
  /** Tile property holding a 0 to 100 percentile, always starting with f_. */
  field: string;
  evidence: Evidence;
  /** 0 to 5; 0 means off. */
  default_weight: number;
  explain: string;
}

export interface LensPreset {
  id: string;
  label: string;
  weights: Record<string, number>;
}

export interface Lens {
  id: string;
  label: string;
  applies_to: AppliesTo;
  description: string;
  factors: LensFactor[];
  presets: LensPreset[];
  release: string;
}

export interface Suggestion {
  id: string;
  label: string;
  applies_to: AppliesTo;
  summary: string;
  evidence: Evidence;
  cost: string;
  routes: string[];
  partners: string[];
  default_on: boolean;
  release: string;
}

export interface RouteLink {
  label: string;
  url: string;
}

export interface Route {
  id: string;
  label: string;
  who: string;
  /** A caution shown before the steps wherever the route appears (docs/ETHICS.md). */
  warning?: string;
  steps: string[];
  cost: string;
  timeline: string;
  links: RouteLink[];
  /** A date written as YYYY-MM-DD. */
  last_checked: string;
  status: RouteStatus;
}

export interface Partner {
  id: string;
  name: string;
  url: string;
  one_line: string;
}

/**
 * An app wide option (registry/options.yaml): a setting that is not tied to one map layer, with
 * a plain description. Options are personal: kept only in this browser, never in a shared link.
 */
export type AppOption = LayerSetting & {
  description: string;
  release: string;
};

export interface Registry {
  groups: Group[];
  licenses: License[];
  sources: Source[];
  layers: Layer[];
  lenses: Lens[];
  suggestions: Suggestion[];
  routes: Route[];
  partners: Partner[];
  options: AppOption[];
}

/** The registry files, in the order they are read. Each file is a YAML list. */
export const REGISTRY_FILES = [
  'groups',
  'licenses',
  'sources',
  'layers',
  'lenses',
  'suggestions',
  'routes',
  'partners',
  'options',
] as const satisfies readonly (keyof Registry)[];

export type RawRegistryFiles = Record<keyof Registry, unknown>;

/** Lens weights run from 0 (off) to this value. */
export const MAX_WEIGHT = 5;
