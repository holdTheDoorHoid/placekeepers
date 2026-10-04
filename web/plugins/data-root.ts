// Serves the data root at <base>data/ while developing (vite) and previewing (vite preview).
//
// Files are looked up first in the real data root (public/data/ in development, which the
// pipeline output and the base map extract are copied into, or dist/data/ in a preview),
// and then in the committed sample at fixtures/data/. Range requests are supported because
// PMTiles reads small byte ranges of large files.

import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect, Plugin } from 'vite';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
export const FIXTURE_DATA_DIR = resolve(WEB_DIR, 'fixtures/data');

const TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.pmtiles': 'application/octet-stream',
  '.pbf': 'application/x-protobuf',
  '.png': 'image/png',
};

/** Finds a file under one of the roots without ever leaving them. */
export function findFile(roots: string[], relative: string): string | null {
  for (const root of roots) {
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) continue;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

export function sendFile(req: IncomingMessage, res: ServerResponse, file: string): void {
  const total = statSync(file).size;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  let start = 0;
  let end = total - 1;
  const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (match && (match[1] || match[2])) {
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    } else {
      start = Math.max(0, total - Number(match[2]));
    }
    if (start >= total || start > end) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${total}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
  }
  res.setHeader('Content-Length', String(end - start + 1));
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file, { start, end }).pipe(res);
}

function middleware(base: string, primaryRoot: string): Connect.NextHandleFunction {
  const prefix = `${base}data/`;
  return (req, res, next) => {
    const url = (req.url ?? '').split('?')[0] ?? '';
    if (!url.startsWith(prefix) || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
    let relative: string;
    try {
      relative = decodeURIComponent(url.slice(prefix.length));
    } catch {
      return next();
    }
    // The real data root is served by Vite itself; only fall back to the sample here.
    if (findFile([primaryRoot], relative)) return next();
    const file = findFile([FIXTURE_DATA_DIR], relative);
    if (!file) return next();
    sendFile(req, res, file);
  };
}

export function dataRootPlugin(): Plugin {
  let base = '/';
  let publicData = '';
  let distData = '';
  return {
    name: 'placekeepers-data-root',
    configResolved(config) {
      base = config.base;
      publicData = resolve(config.publicDir, 'data');
      distData = resolve(config.root, config.build.outDir, 'data');
    },
    configureServer(server) {
      server.middlewares.use(middleware(base, publicData));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(base, distData));
    },
  };
}
