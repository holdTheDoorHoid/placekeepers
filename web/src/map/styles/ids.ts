// The style ids the web app implements. Each registry layer names one of these in its
// `style` key, and the build fails if a layer names a style that is not listed here.
// The implementations live next to this file and are collected in ./index.ts.
export const STYLE_IDS = ['vacant_parcels', 'hin', 'shootings_hex', 'landcare', 'gardens', 'boundary'] as const;
export type StyleId = (typeof STYLE_IDS)[number];
