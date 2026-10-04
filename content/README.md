# Content

These files are the words neighbors read on the site: About, Why this works, How to do it, Use
this responsibly, How we find vacant land, Terms, Privacy, and Contact. The web app turns each
file into its own page when the site is built. See `web/plugins/content.ts` for how, and
`docs/DESIGN.md` section 8.6 for where this folder fits in the project.

**License.** This writing is licensed Creative Commons Attribution ShareAlike 4.0 (CC BY-SA 4.0),
the license the project README promises for written guides. Anyone may copy, share, and adapt it,
even to start a version of this site for another city, as long as they credit Placekeepers and
share their version under the same license.

Code in this repository carries its own license (GPL-3.0 or later, in the root `LICENSE` file).
Only the writing in this folder is CC BY-SA 4.0.

**House style.** Keep the rules from the project's `CLAUDE.md`: plain words an eighth grader can
follow, short paragraphs, active voice, and care framing (never "dangerous," "high crime," or "hot
spot"). No dashes as punctuation anywhere, not even a spaced hyphen used as a pause. Write ranges
as "2019 to 2024" instead. A test checks every file here for dashes automatically
(`web/tests/strings.test.ts`), and it runs in CI, so a stray dash fails the build, not just a
review.

**Adding or renaming a page.** Add a new Markdown file here (its file name becomes its web
address, so `new-page.md` becomes `/new-page/`), add it to the menu list in
`web/src/strings.ts` (the `nav.pages` list), and give it its own `web/<slug>/index.html` next to
the others, following the pattern `web/about/index.html` already uses.
