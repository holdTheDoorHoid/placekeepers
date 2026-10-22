// Who represents each lot (M5.1, issue #45): the sources of the synthetic sample. The sample's
// tables/contacts.json and the `represent` of each parcel in dossiers/9900.json are written by
// hand, like the rest of the dossier files (made up people and organizations, never real ones);
// make-fixtures.mjs lists these sources in the manifest.

/** Source id: [rows, newest record]. */
export const REPRESENT_SOURCES = {
  political_divisions: [1703, null],
  pa_house_districts: [26, null],
  pa_senate_districts: [7, null],
  us_house_districts: [3, null],
  pa_legislators: [253, null],
  us_legislators: [19, null],
  us_legislator_offices: [65, null],
  city_elected_officials: [17, null],
  rco_contacts: [240, null],
};
