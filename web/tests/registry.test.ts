import { describe, expect, it } from 'vitest';
import { loadRegistry, readRegistryFiles } from '../plugins/registry.ts';
import { STYLE_IDS } from '../src/map/styles/ids.ts';
import type { RawRegistryFiles } from '../src/registry/types.ts';
import { validateRegistry } from '../src/registry/validate.ts';

/** A fresh, mutable copy of the real registry YAML for each test. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function raw(): any {
  return structuredClone(readRegistryFiles());
}

function errorsFor(files: RawRegistryFiles): string[] {
  return validateRegistry(files, { styleIds: STYLE_IDS }).errors;
}

function layer(files: Record<string, any>, id: string): Record<string, any> {
  return files.layers.find((l: { id: string }) => l.id === id);
}

describe('the real registry', () => {
  it('passes validation', () => {
    const { registry, errors } = validateRegistry(readRegistryFiles(), { styleIds: STYLE_IDS });
    expect(errors).toEqual([]);
    expect(registry).not.toBeNull();
  });

  it('loads the files the web app depends on', () => {
    const reg = loadRegistry();
    expect(reg.groups.map((g) => g.id)).toEqual(['lots', 'care', 'streets', 'safety_context', 'boundaries', 'basemap']);
    expect(reg.layers.map((l) => l.id)).toEqual(expect.arrayContaining(['vacant_parcels', 'hin_2025', 'shootings_hex']));
    expect(reg.lenses.find((l) => l.id === 'violence')?.factors.length).toBeGreaterThan(0);
  });

  it('keeps dates as text, not as date objects', () => {
    const reg = loadRegistry();
    for (const route of reg.routes) expect(typeof route.last_checked).toBe('string');
  });

  it('keeps choice values as text even when they look like numbers', () => {
    const reg = loadRegistry();
    const setting = reg.layers.find((l) => l.id === 'vacant_parcels')?.settings.find((s) => s.id === 'min_confidence');
    expect(setting?.type).toBe('choice');
    expect(setting?.default).toBe('2');
  });
});

describe('registry validation catches mistakes', () => {
  it('rejects an unknown key, naming the file and the entry', () => {
    const files = raw();
    layer(files, 'hin_2025').colour = 'red';
    expect(errorsFor(files)).toContain('layers.yaml entry "hin_2025" has an unknown key "colour"');
  });

  it('rejects an unknown nested key', () => {
    const files = raw();
    files.sources[0].health.max_age = 3;
    expect(errorsFor(files).some((e) => e.includes('health has an unknown key "max_age"'))).toBe(true);
  });

  it('rejects a missing required key', () => {
    const files = raw();
    delete layer(files, 'hin_2025').description;
    expect(errorsFor(files)).toContain('layers.yaml entry "hin_2025" is missing "description"');
  });

  it('rejects an empty description', () => {
    const files = raw();
    layer(files, 'hin_2025').description = '   ';
    expect(errorsFor(files)).toContain('layers.yaml entry "hin_2025".description is empty');
  });

  it('rejects an evidence level that does not exist', () => {
    const files = raw();
    layer(files, 'hin_2025').evidence = 'very_strong';
    expect(errorsFor(files).some((e) => e.includes('evidence is "very_strong"'))).toBe(true);
  });

  it('rejects ids that are not lowercase with underscores', () => {
    const files = raw();
    layer(files, 'hin_2025').id = 'HIN-2025';
    expect(errorsFor(files).some((e) => e.includes('invalid value "HIN-2025"'))).toBe(true);
  });

  it('rejects two entries with the same id', () => {
    const files = raw();
    files.groups.push({ ...files.groups[0] });
    expect(errorsFor(files)).toContain('groups.yaml has two entries with the id "lots"');
  });

  it('rejects a file that is not a list', () => {
    const files = raw();
    files.partners = { phs: 'yes' };
    expect(errorsFor(files)).toContain('partners.yaml should be a list, found a set of keys and values');
  });

  it('rejects a layer whose view defaults are incomplete', () => {
    const files = raw();
    delete layer(files, 'hin_2025').default.analysis;
    expect(errorsFor(files).some((e) => e.includes('default is missing "analysis"'))).toBe(true);
  });

  it('rejects broken cross references', () => {
    const files = raw();
    layer(files, 'hin_2025').group = 'nowhere';
    layer(files, 'hin_2025').sources = ['no_such_source'];
    files.sources[0].license = 'no_such_license';
    files.suggestions[0].routes = ['no_such_route'];
    files.suggestions[0].partners = ['no_such_partner'];
    files.lenses[0].presets[0].weights.no_such_factor = 2;
    const errors = errorsFor(files);
    expect(errors).toContain('layers.yaml entry "hin_2025" names an unknown group "nowhere"');
    expect(errors).toContain('layers.yaml entry "hin_2025" names an unknown source "no_such_source"');
    expect(errors.some((e) => e.includes('unknown license "no_such_license"'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown route "no_such_route"'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown partner "no_such_partner"'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown factor "no_such_factor"'))).toBe(true);
  });

  it('rejects a style the web app does not implement', () => {
    const files = raw();
    layer(files, 'hin_2025').style = 'sparkles';
    expect(errorsFor(files).some((e) => e.includes('names the style "sparkles"'))).toBe(true);
  });

  it('rejects a choice default that is not an option', () => {
    const files = raw();
    layer(files, 'shootings_hex').settings[0].default = 'm60';
    expect(errorsFor(files).some((e) => e.includes('default "m60" is not one of the options'))).toBe(true);
  });

  it('rejects a choice default written as a number', () => {
    const files = raw();
    layer(files, 'vacant_parcels').settings[0].default = 2;
    expect(errorsFor(files).some((e) => e.includes('should be one of the option values, written as text'))).toBe(true);
  });

  it('checks toggle settings', () => {
    const files = raw();
    layer(files, 'hin_2025').settings = [{ id: 'labels', label: 'Street names', type: 'toggle', default: 'yes' }];
    expect(errorsFor(files).some((e) => e.includes('default should be true or false'))).toBe(true);
    layer(files, 'hin_2025').settings = [{ id: 'labels', label: 'Street names', type: 'toggle', default: true }];
    expect(errorsFor(files)).toEqual([]);
  });

  it('checks range settings and fills in a step of 1', () => {
    const files = raw();
    const settings = layer(files, 'hin_2025');
    settings.settings = [{ id: 'width', label: 'Line width', type: 'range', min: 5, max: 1, default: 9 }];
    const errors = errorsFor(files);
    expect(errors.some((e) => e.includes('needs "min" below "max"'))).toBe(true);
    expect(errors.some((e) => e.includes('default 9 is outside 5 to 1'))).toBe(true);

    settings.settings = [{ id: 'width', label: 'Line width', type: 'range', min: 1, max: 5, default: 2 }];
    const { registry, errors: none } = validateRegistry(files, { styleIds: STYLE_IDS });
    expect(none).toEqual([]);
    const range = registry?.layers.find((l) => l.id === 'hin_2025')?.settings[0];
    expect(range).toMatchObject({ type: 'range', step: 1 });

    settings.settings = [{ id: 'width', label: 'Line width', type: 'range', min: 1, max: 5, default: 2, options: [{ value: 'a', label: 'A' }] }];
    expect(errorsFor(files).some((e) => e.includes('is a range and cannot have "options"'))).toBe(true);
  });

  it('rejects lens weights outside 0 to 5', () => {
    const files = raw();
    files.lenses[0].factors[0].default_weight = 9;
    files.lenses[0].presets[0].weights.untreated_vacancy = -1;
    const errors = errorsFor(files);
    expect(errors.some((e) => e.includes('default_weight is above 5'))).toBe(true);
    expect(errors.some((e) => e.includes('untreated_vacancy is below 0'))).toBe(true);
  });

  it('rejects factor fields that are not f_ percentiles', () => {
    const files = raw();
    files.lenses[0].factors[0].field = 'vacant';
    expect(errorsFor(files).some((e) => e.includes('field has an invalid value "vacant"'))).toBe(true);
  });

  it('rejects a route date that is not YYYY-MM-DD', () => {
    const files = raw();
    files.routes[0].last_checked = 'October 4';
    expect(errorsFor(files).some((e) => e.includes('last_checked has an invalid value'))).toBe(true);
  });

  it('rejects a data file path that climbs out of the data root', () => {
    const files = raw();
    layer(files, 'hin_2025').file = '../secrets.pmtiles';
    expect(errorsFor(files).some((e) => e.includes('file has an invalid value'))).toBe(true);
  });

  it('accepts what the pipeline accepts: optional lists may be left out', () => {
    const files = raw();
    delete layer(files, 'hin_2025').settings;
    delete files.lenses[0].presets;
    delete files.suggestions[0].partners;
    delete files.routes[0].links;
    const { registry, errors } = validateRegistry(files, { styleIds: STYLE_IDS });
    expect(errors).toEqual([]);
    expect(registry?.layers.find((l) => l.id === 'hin_2025')?.settings).toEqual([]);
    expect(registry?.lenses[0]?.presets).toEqual([]);
    expect(registry?.suggestions[0]?.partners).toEqual([]);
    expect(registry?.routes[0]?.links).toEqual([]);
  });

  it('rejects a suggestion with no legal route', () => {
    const files = raw();
    files.suggestions[0].routes = [];
    expect(errorsFor(files).some((e) => e.includes('routes should not be empty'))).toBe(true);
  });

  it('rejects an endpoint missing what its kind needs', () => {
    const files = raw();
    files.sources.find((s: { id: string }) => s.id === 'shootings').endpoint = { kind: 'carto' };
    expect(errorsFor(files)).toContain('sources.yaml entry "shootings".endpoint of kind carto needs "table"');
  });
});
