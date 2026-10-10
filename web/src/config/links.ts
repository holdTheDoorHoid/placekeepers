// Links the site points to that are not in the registry. Partner and route links live in the
// registry; these are the fixed pages that docs/ETHICS.md and the lot dossier must always link,
// each checked on 2026-10-04.

/** The one page every memorial suggestion must point to (docs/ETHICS.md). */
export const FAMILIES_FOR_SAFE_STREETS_URL = 'https://bicyclecoalition.org/programs/families-for-safe-streets/';

/** The City's Tax Center, for today's tax balance (the City no longer publishes it as open data). */
export const TAX_CENTER_URL = 'https://tax-services.phila.gov/';

/** The City's free Fraud Guard deed alerts (Department of Records). */
export const FRAUD_GUARD_URL =
  'https://www.phila.gov/2022-09-06-own-property-in-philadelphia-get-free-deed-fraud-protection-with-fraud-guard/';

/** The City's November 2025 automated check that blocks deeds signed by people already dead. */
export const DEED_FRAUD_CHECK_URL = 'https://www.phila.gov/2025-11-10-philadelphia-launches-new-tool-to-stop-deed-fraud/';

/** The Tangled Title Fund, run by Philadelphia VIP. */
export const TANGLED_TITLE_FUND_URL = 'https://phillyvip.org/tangled-title-fund/';

/** Grounded in Philly's guide to sheriff sales. */
export const SHERIFF_SALE_GUIDE_URL = 'https://groundedinphilly.org/sheriff-sale/';

/** The Garden Justice Legal Initiative, for free legal help. */
export const GJLI_URL = 'https://www.pubintlaw.org/cases-and-advocacy/garden-justice-legal-initiative/';

/**
 * The Philadelphia Land Bank's "View Properties Map", the same list as the City's public property
 * layer filtered to the lots listed as available (issue #36; checked 2026-10-08). Linked, never
 * copied, and never fetched by the pipeline.
 */
export const LAND_BANK_MAP_URL = 'https://phillylandbank.org/view-properties-map/';

/** The Philadelphia Land Bank's board page: agendas, board packages and minutes (checked 2026-10-09). */
export const LAND_BANK_BOARD_URL = 'https://phillylandbank.org/philadelphia-land-bank-board/';

/** The City's real estate transfers on OpenDataPhilly: the deed records the Land Bank page counts. */
export const REAL_ESTATE_TRANSFERS_URL = 'https://opendataphilly.org/datasets/real-estate-transfers/';

/** The City's Land Management dashboard table of properties conveyed by fiscal year (frozen April 2023). */
export const LAND_CONVEYED_BY_FY_URL = 'https://www.arcgis.com/home/item.html?id=db4dcb37071c4cdfb6ca4df82a1de1b3';

/** City Council's legislation search, where Council's resolutions on Land Bank dispositions are published. */
export const COUNCIL_LEGISLATION_URL = 'https://phila.legistar.com/Legislation.aspx';

/** How the Land Bank page counts, in the repository's data source notes. */
export const LAND_BANK_METHOD_URL =
  'https://github.com/holdTheDoorHoid/placekeepers/blob/main/docs/DATA_SOURCES.md#the-land-bank-in-numbers-m44-sources-checked-2026-10-09';

/** The project's repository, where corrections are reported. */
export const REPO_URL = 'https://github.com/holdTheDoorHoid/placekeepers';

/** The City's own page for one property. */
export function propertyPageUrl(opa: string): string {
  return `https://property.phila.gov/?p=${encodeURIComponent(opa)}`;
}

/** Atlas, the City's map of everything it knows about an address; it accepts the OPA account. */
export function atlasUrl(opa: string): string {
  return `https://atlas.phila.gov/${encodeURIComponent(opa)}`;
}

function coords(lng: number, lat: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Google Maps at a point (we link to imagery, never copy it). */
export function googleMapsUrl(lng: number, lat: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${coords(lng, lat)}`;
}

/** Google Street View looking around a point. */
export function streetViewUrl(lng: number, lat: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords(lng, lat)}`;
}

/**
 * The repository's "Report a correction" issue form, prefilled with the parcel and its address
 * (fields from .github/ISSUE_TEMPLATE/correction.yml).
 */
export function correctionUrl(opa: string, address: string | null): string {
  const place = address ? `${opa}, ${address}` : opa;
  const params = new URLSearchParams({
    template: 'correction.yml',
    title: `Correction: ${address ?? `parcel ${opa}`}`,
    place,
  });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

/**
 * Mural Arts Philadelphia's own list of the city's murals. Its terms forbid building a database
 * from its content, so the public art layer links to it and never copies it (checked 2026-10-05).
 */
export const MURAL_ARTS_ARTWORKS_URL = 'https://muralarts.org/artworks/';

/** OpenStreetMap's editor, opened on one element (n123 a node, w123 a way) or at a place. */
export function osmEditUrl(element: string | null, lng: number, lat: number): string {
  const match = /^([nw])(\d+)$/.exec(element ?? '');
  if (match) return `https://www.openstreetmap.org/edit?${match[1] === 'n' ? 'node' : 'way'}=${match[2]}`;
  return `https://www.openstreetmap.org/edit#map=19/${lat.toFixed(6)}/${lng.toFixed(6)}`;
}

// The rules and records of each lot (M4.6, issue #42), each checked on 2026-10-09.

/** The Philadelphia Historical Commission (215 686 7660, preservation@phila.gov). */
export const HISTORICAL_COMMISSION_URL = 'https://www.phila.gov/departments/philadelphia-historical-commission/';
/** How the Commission reviews work on historic properties. */
export const HISTORIC_PROJECT_REVIEW_URL = 'https://www.phila.gov/departments/philadelphia-historical-commission/project-review/';
/** The City's page for finding out whether a property or district is historic. */
export const FIND_HISTORIC_URL = 'https://www.phila.gov/services/property-lots-housing/historic-properties/find-a-historic-property-or-district/';
/** The City's zoning and planning help. */
export const ZONING_HELP_URL = 'https://www.phila.gov/services/zoning-planning-development/';
/** How anyone can take part in a Zoning Board of Adjustment hearing, in person, online, by phone or in writing. */
export const ZBA_TAKE_PART_URL = 'https://www.phila.gov/services/zoning-planning-development/participate-in-a-zoning-board-of-adjustment-hearing/';
/** The L&I Review Board and the Board of Building Standards. */
export const LIRB_URL = 'https://www.phila.gov/departments/board-of-license-and-inspection-review/';
export const BBS_URL = 'https://www.phila.gov/departments/board-of-building-standards/';
/** L&I's calendar of appeal hearings. */
export const APPEALS_CALENDAR_URL = 'https://li.phila.gov/appeals-calendar';
/** Penn State Extension's soil test, which checks for lead. */
export const SOIL_TEST_URL = 'https://agsci.psu.edu/aasl/soil-testing';
/** The EPA's guide to growing gardens in urban soils. */
export const EPA_GARDEN_GUIDE_URL = 'https://www.epa.gov/sites/default/files/2014-03/documents/urban_gardening_fina_fact_sheet.pdf';

/** How to take part in a hearing, by board. */
export const TAKE_PART_URLS: Record<string, string> = {
  zoning: ZBA_TAKE_PART_URL,
  li_review: LIRB_URL,
  building: BBS_URL,
  other: APPEALS_CALENDAR_URL,
};

/** One brownfield property in the EPA's facility registry, by its registry id. */
export function epaRecordUrl(registryId: string): string {
  return `https://frs-public.epa.gov/ords/frs_public2/fii_query_detail.disp_program_facility?p_registry_id=${encodeURIComponent(registryId)}`;
}

/**
 * L&I's property history for an address, which lists the property's appeals and opens each one
 * with its grounds. The lot page links there instead of copying the grounds.
 */
export function liHistoryUrl(address: string): string {
  return `https://li.phila.gov/property-history/search?address=${encodeURIComponent(address)}`;
}

/** The zoning part of Atlas for a parcel: its base district, overlays and appeals. */
export function atlasZoningUrl(opa: string): string {
  return `https://atlas.phila.gov/${encodeURIComponent(opa)}/zoning`;
}
