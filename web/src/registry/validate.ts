// Validates the registry YAML against the contract in docs/CONTRACTS.md, section 1.
//
// Rules: unknown keys are an error (so typos fail fast), required keys must be present,
// values must have the right type, ids are lowercase with underscores and unique per file,
// and every cross reference (group, source, license, route, partner, factor, style) must
// resolve. The build calls this through plugins/registry.ts and stops on any error.

import {
  APPLIES_TO,
  CADENCES,
  ENDPOINT_KINDS,
  EVIDENCE_LEVELS,
  GEOMETRIES,
  MAX_WEIGHT,
  REGISTRY_FILES,
  ROUTE_STATUSES,
  SETTING_TYPES,
  URL_FORMATS,
  VIEWS,
  type RawRegistryFiles,
  type Registry,
} from './types.ts';

export const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const RELEASE_PATTERN = /^v\d+\.\d+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FIELD_PATTERN = /^f_[a-z0-9_]+$/;
// The same rules the pipeline applies (pipeline/src/placekeepers/registry.py), so a registry
// one side accepts never breaks the other.
const URL_PATTERN = /^https?:\/\/\S+$/;
const DATA_PATH_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$/;
/** An OpenStreetMap tag an extract keeps: "key=value", or "key" for any value (added by M2.2). */
const OSM_TAG_PATTERN = /^[A-Za-z0-9_:.-]+(=[A-Za-z0-9_:;.-]+)?$/;
const OSM_EXTRACT_URL_PATTERN = /^https:\/\/\S+\.osm\.pbf$/;
/** A layer's guide: the slug of a content page (content/<slug>.md). */
const GUIDE_PATTERN = /^[a-z][a-z0-9-]*$/;

type Spec =
  | { t: 'string'; optional?: boolean; pattern?: RegExp; oneOf?: readonly string[]; allowEmpty?: boolean }
  | { t: 'number'; optional?: boolean; integer?: boolean; min?: number; max?: number }
  | { t: 'boolean'; optional?: boolean }
  | { t: 'strings'; optional?: boolean; pattern?: RegExp; nonEmpty?: boolean }
  | { t: 'object'; optional?: boolean; fields: Fields }
  | { t: 'objects'; optional?: boolean; fields: Fields; nonEmpty?: boolean }
  | { t: 'weights'; optional?: boolean }
  | { t: 'any'; optional?: boolean };
type Fields = Record<string, Spec>;

const str = (extra: Partial<Extract<Spec, { t: 'string' }>> = {}): Spec => ({ t: 'string', ...extra });
const id = (): Spec => str({ pattern: ID_PATTERN });
const text = (): Spec => str();
const url = (): Spec => str({ pattern: URL_PATTERN });
const release = (): Spec => str({ pattern: RELEASE_PATTERN });
const evidence = (): Spec => str({ oneOf: EVIDENCE_LEVELS });
const ids = (extra: { nonEmpty?: boolean } = {}): Spec => ({ t: 'strings', pattern: ID_PATTERN, ...extra });

const SCHEMAS: Record<keyof Registry, Fields> = {
  groups: { id: id(), label: text(), description: text() },
  licenses: { id: id(), label: text(), url: url(), share_alike: { t: 'boolean' } },
  sources: {
    id: id(),
    name: text(),
    publisher: text(),
    homepage: url(),
    endpoint: {
      t: 'object',
      fields: {
        kind: str({ oneOf: ENDPOINT_KINDS }),
        table: str({ optional: true }),
        where: str({ optional: true }),
        service: str({ optional: true }),
        layer: { t: 'number', optional: true, integer: true, min: 0 },
        url: str({ optional: true, pattern: URL_PATTERN }),
        format: str({ optional: true, oneOf: URL_FORMATS }),
        path: str({ optional: true }),
        tags: { t: 'strings', optional: true, pattern: OSM_TAG_PATTERN, nonEmpty: true },
      },
    },
    license: id(),
    attribution: text(),
    cadence: str({ oneOf: CADENCES }),
    health: {
      t: 'object',
      fields: {
        min_rows: { t: 'number', optional: true, integer: true, min: 0 },
        max_drop_pct: { t: 'number', optional: true, min: 0, max: 100 },
        newest_field: str({ optional: true }),
        max_age_days: { t: 'number', optional: true, integer: true, min: 0 },
      },
    },
    release: release(),
  },
  layers: {
    id: id(),
    label: text(),
    group: id(),
    description: text(),
    sources: ids({ nonEmpty: true }),
    file: str({ pattern: DATA_PATH_PATTERN }),
    source_layer: id(),
    geometry: str({ oneOf: GEOMETRIES }),
    style: id(),
    evidence: evidence(),
    default: { t: 'object', fields: { field: { t: 'boolean' }, analysis: { t: 'boolean' } } },
    guide: str({ optional: true, pattern: GUIDE_PATTERN }),
    settings: {
      t: 'objects',
      optional: true,
      fields: {
        id: id(),
        label: text(),
        type: str({ oneOf: SETTING_TYPES }),
        default: { t: 'any' },
        options: {
          t: 'objects',
          optional: true,
          nonEmpty: true,
          fields: { value: str({ allowEmpty: true }), label: text() },
        },
        min: { t: 'number', optional: true },
        max: { t: 'number', optional: true },
        step: { t: 'number', optional: true, min: 0 },
      },
    },
    release: release(),
  },
  lenses: {
    id: id(),
    label: text(),
    applies_to: str({ oneOf: APPLIES_TO }),
    description: text(),
    factors: {
      t: 'objects',
      nonEmpty: true,
      fields: {
        id: id(),
        label: text(),
        field: str({ pattern: FIELD_PATTERN }),
        evidence: evidence(),
        default_weight: { t: 'number', integer: true, min: 0, max: MAX_WEIGHT },
        explain: text(),
      },
    },
    presets: {
      t: 'objects',
      optional: true,
      fields: { id: id(), label: text(), weights: { t: 'weights' } },
    },
    release: release(),
  },
  suggestions: {
    id: id(),
    label: text(),
    applies_to: str({ oneOf: APPLIES_TO }),
    summary: text(),
    evidence: evidence(),
    cost: text(),
    routes: ids({ nonEmpty: true }),
    partners: { t: 'strings', pattern: ID_PATTERN, optional: true },
    default_on: { t: 'boolean' },
    release: release(),
  },
  routes: {
    id: id(),
    label: text(),
    who: text(),
    warning: str({ optional: true }),
    steps: { t: 'strings', nonEmpty: true },
    cost: text(),
    timeline: text(),
    links: { t: 'objects', optional: true, fields: { label: text(), url: url() } },
    last_checked: str({ pattern: DATE_PATTERN }),
    status: str({ oneOf: ROUTE_STATUSES }),
  },
  partners: { id: id(), name: text(), url: url(), one_line: text() },
  options: {
    id: id(),
    label: text(),
    description: text(),
    type: str({ oneOf: SETTING_TYPES }),
    default: { t: 'any' },
    options: {
      t: 'objects',
      optional: true,
      nonEmpty: true,
      fields: { value: str({ allowEmpty: true }), label: text() },
    },
    min: { t: 'number', optional: true },
    max: { t: 'number', optional: true },
    step: { t: 'number', optional: true, min: 0 },
    release: release(),
  },
};

const ENDPOINT_REQUIRED: Record<string, string[]> = {
  carto: ['table'],
  arcgis: ['service', 'layer'],
  url: ['url', 'format'],
  curated: ['path'],
  osm_extract: [],
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (v === null) return 'nothing';
  if (Array.isArray(v)) return 'a list';
  if (v instanceof Date) return 'a date (put it in quotes)';
  if (typeof v === 'object') return 'a set of keys and values';
  return `a ${typeof v}`;
}

function checkValue(spec: Spec, value: unknown, where: string, errors: string[]): void {
  switch (spec.t) {
    case 'any':
      return;
    case 'string': {
      if (typeof value !== 'string') {
        errors.push(`${where} should be text, found ${describe(value)}`);
        return;
      }
      if (!spec.allowEmpty && value.trim() === '') errors.push(`${where} is empty`);
      if (spec.pattern && !spec.pattern.test(value)) errors.push(`${where} has an invalid value "${value}"`);
      if (spec.oneOf && !spec.oneOf.includes(value)) {
        errors.push(`${where} is "${value}", expected one of: ${spec.oneOf.join(', ')}`);
      }
      return;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${where} should be a number, found ${describe(value)}`);
        return;
      }
      if (spec.integer && !Number.isInteger(value)) errors.push(`${where} should be a whole number`);
      if (spec.min !== undefined && value < spec.min) errors.push(`${where} is below ${spec.min}`);
      if (spec.max !== undefined && value > spec.max) errors.push(`${where} is above ${spec.max}`);
      return;
    }
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${where} should be true or false, found ${describe(value)}`);
      return;
    case 'strings': {
      if (!Array.isArray(value)) {
        errors.push(`${where} should be a list, found ${describe(value)}`);
        return;
      }
      if (spec.nonEmpty && value.length === 0) errors.push(`${where} should not be empty`);
      value.forEach((item, i) => {
        if (typeof item !== 'string' || item.trim() === '') {
          errors.push(`${where}[${i}] should be text`);
        } else if (spec.pattern && !spec.pattern.test(item)) {
          errors.push(`${where}[${i}] has an invalid value "${item}"`);
        }
      });
      const seen = new Set<string>();
      for (const item of value) {
        if (typeof item === 'string' && seen.has(item)) errors.push(`${where} repeats "${item}"`);
        if (typeof item === 'string') seen.add(item);
      }
      return;
    }
    case 'object':
      checkFields(spec.fields, value, where, errors);
      return;
    case 'objects': {
      if (!Array.isArray(value)) {
        errors.push(`${where} should be a list, found ${describe(value)}`);
        return;
      }
      if (spec.nonEmpty && value.length === 0) errors.push(`${where} should not be empty`);
      value.forEach((item, i) => checkFields(spec.fields, item, `${where}[${i}]`, errors));
      return;
    }
    case 'weights': {
      if (!isPlainObject(value)) {
        errors.push(`${where} should be a map of factor ids to weights, found ${describe(value)}`);
        return;
      }
      for (const [k, w] of Object.entries(value)) {
        if (!ID_PATTERN.test(k)) errors.push(`${where} has an invalid factor id "${k}"`);
        checkValue({ t: 'number', integer: true, min: 0, max: MAX_WEIGHT }, w, `${where}.${k}`, errors);
      }
      return;
    }
  }
}

function checkFields(fields: Fields, value: unknown, where: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${where} should be a set of keys and values, found ${describe(value)}`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!(key in fields)) errors.push(`${where} has an unknown key "${key}"`);
  }
  for (const [key, spec] of Object.entries(fields)) {
    if (!(key in value) || value[key] === undefined) {
      if (!spec.optional) errors.push(`${where} is missing "${key}"`);
      continue;
    }
    checkValue(spec, value[key], `${where}.${key}`, errors);
  }
}

function entryName(file: string, entry: unknown, index: number): string {
  const entryId = isPlainObject(entry) && typeof entry.id === 'string' ? `"${entry.id}"` : `#${index + 1}`;
  return `${file}.yaml entry ${entryId}`;
}

function checkSetting(raw: Record<string, unknown>, where: string, errors: string[]): void {
  const type = raw.type;
  const has = (k: string) => k in raw && raw[k] !== undefined;
  if (type === 'choice') {
    if (!has('options')) errors.push(`${where} is a choice and needs "options"`);
    for (const k of ['min', 'max', 'step']) if (has(k)) errors.push(`${where} is a choice and cannot have "${k}"`);
    if (Array.isArray(raw.options)) {
      const values = raw.options.map((o) => (isPlainObject(o) ? o.value : undefined));
      const seen = new Set<unknown>();
      for (const v of values) {
        if (seen.has(v)) errors.push(`${where}.options repeats the value "${String(v)}"`);
        seen.add(v);
      }
      if (typeof raw.default !== 'string') {
        errors.push(`${where}.default should be one of the option values, written as text`);
      } else if (!values.includes(raw.default)) {
        errors.push(`${where}.default "${raw.default}" is not one of the options`);
      }
    }
  } else if (type === 'toggle') {
    for (const k of ['options', 'min', 'max', 'step']) if (has(k)) errors.push(`${where} is a toggle and cannot have "${k}"`);
    if (typeof raw.default !== 'boolean') errors.push(`${where}.default should be true or false`);
  } else if (type === 'range') {
    if (has('options')) errors.push(`${where} is a range and cannot have "options"`);
    if (!has('min')) errors.push(`${where} is a range and needs "min"`);
    if (!has('max')) errors.push(`${where} is a range and needs "max"`);
    const min = raw.min;
    const max = raw.max;
    const def = raw.default;
    if (typeof min === 'number' && typeof max === 'number') {
      if (min >= max) errors.push(`${where} needs "min" below "max"`);
      if (typeof def !== 'number' || !Number.isFinite(def)) {
        errors.push(`${where}.default should be a number`);
      } else if (def < min || def > max) {
        errors.push(`${where}.default ${def} is outside ${min} to ${max}`);
      }
    }
    if (has('step') && raw.step === 0) errors.push(`${where}.step should be above 0`);
  }
}

export interface ValidateOptions {
  /** Style ids the web app implements; a layer naming any other style is an error. */
  styleIds?: readonly string[];
}

export interface ValidationResult {
  registry: Registry | null;
  errors: string[];
}

/** Validates the parsed YAML files and returns a typed registry, or the list of problems. */
export function validateRegistry(raw: RawRegistryFiles, options: ValidateOptions = {}): ValidationResult {
  const errors: string[] = [];

  for (const file of REGISTRY_FILES) {
    const list = raw[file];
    if (!Array.isArray(list)) {
      errors.push(`${file}.yaml should be a list, found ${describe(list)}`);
      continue;
    }
    const seen = new Set<string>();
    list.forEach((entry, i) => {
      const where = entryName(file, entry, i);
      checkFields(SCHEMAS[file], entry, where, errors);
      if (isPlainObject(entry) && typeof entry.id === 'string') {
        if (seen.has(entry.id)) errors.push(`${file}.yaml has two entries with the id "${entry.id}"`);
        seen.add(entry.id);
      }
    });
  }
  if (errors.length > 0) return { registry: null, errors };

  // The shapes are right from here on, so the cast is safe once optional lists are filled in.
  const reg = structuredClone(raw) as unknown as Registry;
  for (const layer of reg.layers) layer.settings ??= [];
  for (const lens of reg.lenses) lens.presets ??= [];
  for (const suggestion of reg.suggestions) suggestion.partners ??= [];
  for (const route of reg.routes) route.links ??= [];
  const idsOf = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const groups = idsOf(reg.groups);
  const sources = idsOf(reg.sources);
  const licenses = idsOf(reg.licenses);
  const routes = idsOf(reg.routes);
  const partners = idsOf(reg.partners);
  const styles = options.styleIds ? new Set(options.styleIds) : null;

  for (const source of reg.sources) {
    const where = `sources.yaml entry "${source.id}"`;
    if (!licenses.has(source.license)) errors.push(`${where} names an unknown license "${source.license}"`);
    for (const key of ENDPOINT_REQUIRED[source.endpoint.kind] ?? []) {
      if (!(key in source.endpoint)) errors.push(`${where}.endpoint of kind ${source.endpoint.kind} needs "${key}"`);
    }
    if (source.endpoint.kind === 'osm_extract') {
      // An extract the pipeline downloads has both; the base map, which the site makes, has neither.
      if (('url' in source.endpoint) !== ('tags' in source.endpoint)) {
        errors.push(`${where}.endpoint of kind osm_extract needs both "url" and "tags", or neither`);
      }
      if (source.endpoint.url !== undefined && !OSM_EXTRACT_URL_PATTERN.test(source.endpoint.url)) {
        errors.push(`${where}.endpoint.url should be an https link to an .osm.pbf file`);
      }
    }
  }

  for (const layer of reg.layers) {
    const where = `layers.yaml entry "${layer.id}"`;
    if (!groups.has(layer.group)) errors.push(`${where} names an unknown group "${layer.group}"`);
    for (const s of layer.sources) if (!sources.has(s)) errors.push(`${where} names an unknown source "${s}"`);
    if (styles && !styles.has(layer.style)) {
      errors.push(`${where} names the style "${layer.style}", which web/src/map/styles does not have`);
    }
    for (const view of VIEWS) {
      if (typeof layer.default[view] !== 'boolean') errors.push(`${where}.default needs "${view}"`);
    }
    const settingIds = new Set<string>();
    layer.settings.forEach((setting, i) => {
      const sw = `${where}.settings[${i}]`;
      if (settingIds.has(setting.id)) errors.push(`${where} has two settings with the id "${setting.id}"`);
      settingIds.add(setting.id);
      checkSetting(setting as unknown as Record<string, unknown>, sw, errors);
      if (setting.type === 'range' && setting.step === undefined) setting.step = 1;
    });
  }

  for (const lens of reg.lenses) {
    const where = `lenses.yaml entry "${lens.id}"`;
    const factorIds = new Set<string>();
    const fields = new Set<string>();
    for (const f of lens.factors) {
      if (factorIds.has(f.id)) errors.push(`${where} has two factors with the id "${f.id}"`);
      if (fields.has(f.field)) errors.push(`${where} uses the field "${f.field}" twice`);
      factorIds.add(f.id);
      fields.add(f.field);
    }
    const presetIds = new Set<string>();
    for (const preset of lens.presets) {
      if (presetIds.has(preset.id)) errors.push(`${where} has two presets with the id "${preset.id}"`);
      presetIds.add(preset.id);
      for (const factor of Object.keys(preset.weights)) {
        if (!factorIds.has(factor)) errors.push(`${where} preset "${preset.id}" names an unknown factor "${factor}"`);
      }
    }
  }

  for (const option of reg.options) {
    // An app wide option follows the same rules for each type as a layer setting.
    checkSetting(option as unknown as Record<string, unknown>, `options.yaml entry "${option.id}"`, errors);
    if (option.type === 'range' && option.step === undefined) option.step = 1;
  }

  for (const suggestion of reg.suggestions) {
    const where = `suggestions.yaml entry "${suggestion.id}"`;
    for (const r of suggestion.routes) if (!routes.has(r)) errors.push(`${where} names an unknown route "${r}"`);
    for (const p of suggestion.partners) if (!partners.has(p)) errors.push(`${where} names an unknown partner "${p}"`);
  }

  return errors.length > 0 ? { registry: null, errors } : { registry: reg, errors: [] };
}

/** Throws one readable error listing every problem. Used by the build. */
export function assertValidRegistry(raw: RawRegistryFiles, options: ValidateOptions = {}): Registry {
  const { registry, errors } = validateRegistry(raw, options);
  if (!registry) {
    throw new Error(`The registry has ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  }
  return registry;
}
