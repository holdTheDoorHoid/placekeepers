// The base map underneath the data (registry layer `basemap`, style `basemap`). It follows the
// "everything is a setting" rule like any other layer: its switch turns the base map off, leaving
// a plain background, and its "look" setting picks the colors.
//
// Unlike the other styles it adds no layers of its own: the base map's layers come with the map's
// starting style (src/map/basemap.ts), and the map controller restyles them in place to match
// what layers() returns here. For the self hosted Protomaps extract, a look is a Protomaps
// "flavor": light, or grayscale for the gray look.

import { layers as protomapsLayers, namedFlavor } from '@protomaps/basemaps';
import type { LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { PLAIN_BACKGROUND } from './palette.ts';
import { settingValue, type LegendContext, type StyleModule } from './types.ts';

/** The looks the registry offers, and the Protomaps flavor that draws each. */
export const BASEMAP_FLAVORS = { light: 'light', muted: 'grayscale' } as const;
export type BasemapLook = keyof typeof BASEMAP_FLAVORS;

/** The chosen look, or the light one for a value this version does not know. */
export function basemapLook(ctx: LegendContext): BasemapLook {
  const value = settingValue(ctx, 'look');
  return typeof value === 'string' && value in BASEMAP_FLAVORS ? (value as BasemapLook) : 'light';
}

/** The Protomaps layers for one look. Every look's layers are a subset of the light look's. */
export function flavorLayers(sourceId: string, look: BasemapLook): LayerSpecification[] {
  return protomapsLayers(sourceId, namedFlavor(BASEMAP_FLAVORS[look]), { lang: 'en' }) as LayerSpecification[];
}

function withVisibility(spec: LayerSpecification, visible: boolean): LayerSpecification {
  return { ...spec, layout: { ...(spec.layout ?? {}), visibility: visible ? 'visible' : 'none' } } as LayerSpecification;
}

/**
 * The base layers as they should be drawn. `base` is the map's starting base layers: for the
 * Protomaps extract, the light look, which holds every layer any look uses. The gray look takes
 * the grayscale colors and hides the layers it does not draw. Turning the base map off hides
 * everything but the background, which turns plain, so the data still sits on a quiet color.
 * Another base map (a hosted style, or none) can only be shown or hidden.
 */
export function restyleBase(base: LayerSpecification[], look: BasemapLook, visible: boolean, protomaps: boolean): LayerSpecification[] {
  const source = base.find((l): l is LayerSpecification & { source: string } => 'source' in l && typeof l.source === 'string')?.source;
  const target = protomaps && source && look !== 'light' ? new Map(flavorLayers(source, look).map((l) => [l.id, l])) : null;
  return base.map((spec) => {
    if (spec.type === 'background') {
      const colored = target?.get(spec.id) ?? spec;
      const plain = { ...colored, paint: { 'background-color': PLAIN_BACKGROUND } } as LayerSpecification;
      return withVisibility(visible ? colored : plain, true);
    }
    if (!visible) return withVisibility(spec, false);
    if (!target) return withVisibility(spec, true);
    const restyled = target.get(spec.id);
    return restyled ? withVisibility(restyled, true) : withVisibility(spec, false);
  });
}

export const basemap: StyleModule = {
  zIndex: 0,
  settings: ['look'],
  clickable: [],
  base: true,
  /** The Protomaps base layers as the switch and the look want them drawn. */
  layers(ctx) {
    const visible = ctx.state.layers.includes(ctx.layer.id);
    return restyleBase(flavorLayers(ctx.sourceId, 'light'), basemapLook(ctx), visible, true);
  },
  legend(ctx) {
    return [{ kind: 'note', text: basemapLook(ctx) === 'muted' ? strings.basemap.legendMuted : strings.basemap.legend }];
  },
};
