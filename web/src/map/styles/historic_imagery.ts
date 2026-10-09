// Then and now (M4.3): a picture layer from the City's own servers, the aerial photographs of a
// chosen year or the 1860 atlas, drawn under every other layer and under the base map's labels.
// Each service (each year) is its own raster source, named in src/map/raster.ts: the style draws
// the chosen one, and the controller adds that source when the layer is shown. Settings:
//   year     which year's photos (a slider through the years the City serves), when there are several
//   opacity  how strongly the picture shows, in percent

import type { LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { chosenService, rasterOpacity, rasterTiles, tileSource } from '../raster.ts';
import { partId, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

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
    const source = tileSource(ctx.layer, ctx.registry);
    const services = source?.endpoint.services ?? [];
    const entries: LegendEntry[] = [];
    if (services.length > 1) {
      const year = chosenService(ctx.layer, ctx.registry, ctx.state)?.key ?? '';
      entries.push({ kind: 'note', text: h.photoYear(year) });
      if (year === '1996') entries.push({ kind: 'note', text: h.blackAndWhite });
      entries.push({ kind: 'note', text: h.under });
      entries.push({ kind: 'note', text: h.photoCredit });
    } else {
      entries.push({ kind: 'note', text: h.atlasCoverage });
      entries.push({ kind: 'note', text: h.atlasCredit });
    }
    return entries;
  },
};
