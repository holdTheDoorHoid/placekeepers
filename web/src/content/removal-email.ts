// The dedicated takedown and removal email address (DESIGN.md section 12, item 1: "Create a
// dedicated takedown email address"; ROADMAP.md: "Create a dedicated email address for
// corrections and removal requests (needed by M1.8)"). The owner has not created it yet.
//
// This is the ONE place that address lives. Once the owner creates it, set it here and the
// Contact page picks it up on the next build, with no other file to change. Until then, leave it
// null: the Contact page says "coming soon" instead of showing a made up address. Never publish
// the owner's personal email here (ETHICS.md, "Contributions and takedowns").
export const REMOVAL_EMAIL: string | null = null;
