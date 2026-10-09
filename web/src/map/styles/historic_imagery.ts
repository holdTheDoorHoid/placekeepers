// Then and now (M4.3): a picture layer from the City's own servers, the aerial photographs of a
// chosen year or the 1860 atlas, drawn under every other layer and under the base map's labels.
// Each service (each year) is its own raster source, named in src/map/raster.ts: the style draws
// the chosen one, and the controller adds that source when the layer is shown. Settings:
//   year     which year's photos (a slider through the years the City serves), when there are several
//   opacity  how strongly the picture shows, in percent

import type { LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { chosenService, rasterOpacity, rasterTiles, tileSources } from '../raster.ts';
import { partId, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

/** The years whose photos are in black and white (checked 2026-10-09). */
const BLACK_AND_WHITE = new Set(['1959', '1975', '1996', '1999', '2000']);

export const historicImagery: StyleModule = {
  // The lowest of the data layers: a photo covers the base map, never the places drawn on it.
  zIndex: 1,
  settings: ['year', 'opacity'],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'picture'),
        type: 'raster',
        // The chosen year's own source (src/map/raster.ts), which the controller adds for it.
        source: rasterTiles(ctx.layer, ctx.registry, ctx.state)?.sourceId ?? ctx.sourceId,
        paint: { 'raster-opacity': rasterOpacity(ctx.layer, ctx.state), 'raster-fade-duration': 150 },
      },
    ];
  },

  legend(ctx) {
    const h = strings.historic;
    const sources = tileSources(ctx.layer, ctx.registry);
    const services = sources.flatMap((s) => s.endpoint.services ?? []);
    const entries: LegendEntry[] = [];
    if (services.length > 1) {
      const chosen = chosenService(ctx.layer, ctx.registry, ctx.state);
      const year = chosen?.service.key ?? '';
      entries.push({ kind: 'note', text: h.photoYear(year) });
      if (BLACK_AND_WHITE.has(year)) entries.push({ kind: 'note', text: h.blackAndWhite(year) });
      if (year === '1975') entries.push({ kind: 'note', text: h.gaps1975 });
      entries.push({ kind: 'note', text: h.under });
      // Each year is credited to its own publisher, as its source says.
      if (chosen) entries.push({ kind: 'note', text: chosen.source.attribution });
      if (chosen?.source.license === 'unstated') {
        entries.push({ kind: 'note', text: h.termsNotStated });
      }
    } else {
      entries.push({ kind: 'note', text: h.atlasCoverage });
      entries.push({ kind: 'note', text: h.atlasCredit });
    }
    return entries;
  },
};
