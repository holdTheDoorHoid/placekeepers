// The style ids the web app implements. Each registry layer names one of these in its
// `style` key, and the build fails if a layer names a style that is not listed here.
// The implementations live next to this file and are collected in ./index.ts.
export const STYLE_IDS = [
  'vacant_parcels',
  'hin',
  'shootings_hex',
  'landcare',
  'gardens',
  'boundary',
  'street_segments',
  'crashes',
  'memorials',
  'basemap',
  'transit_stops',
  'transit_routes',
  'stop_amenities',
  // Heat, trees and the floodplain (M3.1)
  'heat_tracts',
  'city_trees',
  'floodplain',
  // M3.5: amenities from OpenStreetMap, public places from the City, conditions reported to 311
  'amenity',
  'public_place',
  'condition',
  // Public art (M3.2)
  'public_art',
] as const;
export type StyleId = (typeof STYLE_IDS)[number];
