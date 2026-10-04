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
