// Vite plugin: reads ../registry/*.yaml at build time, validates it against the contract,
// and serves it to the app as the module "virtual:placekeepers/registry". Any problem in
// the registry stops the build (and the dev server shows the list of problems).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { parse } from 'yaml';
import { STYLE_IDS } from '../src/map/styles/ids.ts';
import { REGISTRY_FILES, type RawRegistryFiles, type Registry } from '../src/registry/types.ts';
import { assertValidRegistry } from '../src/registry/validate.ts';

export const REGISTRY_DIR = fileURLToPath(new URL('../../registry', import.meta.url));

const VIRTUAL_ID = 'virtual:placekeepers/registry';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** Reads and parses every registry file. Throws if a file is missing or is not valid YAML. */
export function readRegistryFiles(dir: string = REGISTRY_DIR): RawRegistryFiles {
  const raw: Partial<RawRegistryFiles> = {};
  for (const file of REGISTRY_FILES) {
    const path = resolve(dir, `${file}.yaml`);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      throw new Error(`The registry file ${path} is missing.`);
    }
    try {
      raw[file] = parse(text, { prettyErrors: true, uniqueKeys: true });
    } catch (error) {
      throw new Error(`${file}.yaml is not valid YAML: ${(error as Error).message}`);
    }
  }
  return raw as RawRegistryFiles;
}

/** Reads, parses and validates the registry, throwing one error that lists every problem. */
export function loadRegistry(dir: string = REGISTRY_DIR): Registry {
  return assertValidRegistry(readRegistryFiles(dir), { styleIds: STYLE_IDS });
}

export function registryPlugin(dir: string = REGISTRY_DIR): Plugin {
  return {
    name: 'placekeepers-registry',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      for (const file of REGISTRY_FILES) this.addWatchFile(resolve(dir, `${file}.yaml`));
      return `export default ${JSON.stringify(loadRegistry(dir))};`;
    },
  };
}
