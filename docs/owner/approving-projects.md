# Approving projects neighbors finished

Neighbors tell us about projects they finished with the form "Tell us about a project you
finished" on GitHub. Nothing they send appears on the map until you approve it. This page shows how
to read a report, what to check, and how to approve or remove it with one click, on a computer or a
phone.

## Where reports arrive

Each report is a GitHub issue whose title starts with "Project:" and which carries the label
`project-report`. GitHub emails you about each new one if you watch the repository. To see them
all: open the repository's Issues tab and click the label `project-report`, or use this link:
<https://github.com/holdTheDoorHoid/placekeepers/issues?q=is%3Aopen+label%3Aproject-report>.

## How to read a report

A report has these answers:

- **What was done**: a cleanup, a garden, a place to sit, a mural or art, trees, a shelter or bench
  the City installed, a 311 fix, or other.
- **Where**: usually a link to the lot's page on our map (it opens the lot, so you can see it),
  a parcel number, or a street address.
- **Month and year it was finished.**
- **Was permission given?**: yes from the owner, yes from the City or Land Bank, not needed, or no
  or not sure. This answer never appears on the map, and it is never a reason to say no. The form
  promises neighbors we never judge it.
- **Group name to show** (optional): this is the only name the map ever shows.
- **What it took** (optional): a few sentences the map shows.
- **The box agreeing** that the report may be shown on the map under the site's data license.
- Photos, if the person added any, below the answers or in comments.

## What to check before approving

1. **It is a real project, in Philadelphia.** Click the lot link, or search the address on the map.
   A cleanup or a garden on a vacant lot, trees on a block, a mural on a wall, a bench at a bus stop:
   yes. An advertisement, a joke, or something outside the city: no.
2. **The group name and the note are fine to show on a public map.** No names of private people,
   no phone numbers or home addresses, nothing hateful, nothing that calls for police enforcement.
   The map leaves out links, email addresses, phone numbers and GitHub user names by itself, but a
   person's name in the note can only be caught by you.
3. **Photos.** Photos stay on GitHub and the map never shows them, but they are public there. If a
   photo shows the face of a child, or of anyone who may not have agreed, or a license plate, remove
   it before approving: on the report, click the three dots at the top right of the text, choose
   Edit, delete the line with the photo, and save. GitHub keeps earlier versions in an "edited"
   menu at the top of the report; open it, pick the version with the photo, and choose to delete it
   from the history. Then approve.
4. **The date** is not in the future (the map checks this too).

You do not need to check whether they had permission. The map does not show it.

## Approve with one click

On a computer: open the report, find **Labels** in the right column, click the gear, and tick
**project-approved**. Click anywhere outside the list to close it.

On a phone, in the GitHub app: open the report, tap the three dots at the top right (or scroll to
the **Labels** row), tap **Labels**, tick **project-approved**, and tap Done. In a phone's web
browser it works like on a computer: the Labels gear is below the report's text.

That is all. Within a few minutes a workflow called "Publish approved projects" runs by itself and
puts the project on the map. Usually it is live within half an hour; if the weekly data update is
running at that moment, it waits for that to finish first, so it can take up to two hours. It is
always on the map after the next weekly update.

You can close the report as completed at any time; a closed report stays on the map as long as it
carries the label.

## Did it reach the map?

Open the repository's **Actions** tab, click **Publish approved projects**, and open the newest run.
Its summary page has a table with every approved report and either "Yes" or "No" with the reason,
for example "the address could not be found in the City's property list" or "the box agreeing to
show it on the map is not ticked". The site's **Data status** page lists the same reasons in its
notes.

If a report is held back:

- **The place could not be found.** Ask the reporter, in a comment, for the link to the lot's page
  on the map. Or fix it yourself in `data/curated/interventions.yaml` (below).
- **The box is not ticked.** Ask the reporter to edit the report and tick it.
- **Someone changed it after you approved it.** When anyone but you edits a report after you
  approve it, it comes off the map until you look again, so nothing unreviewed is ever shown. Read
  the new text, then remove the label and add it again. Your own edits never need this.
- **The month is in the future**, or the year looks wrong: ask the reporter, or fix it in the file.

## Remove a project

- **Remove the label** `project-approved`. The project leaves the map within a few minutes (and at
  the next weekly update at the latest).
- Or **close the report as "not planned"**. Same effect.
- For a project that must never come back, even if someone adds the label again by mistake, add its
  issue number to `data/curated/interventions.yaml` with `suppressed: true` (below). That always
  wins.

## The file for fixes and hand entries

`data/curated/interventions.yaml` holds fixes and projects nobody reported through the form. Edit it
on GitHub (open the file, click the pencil, change it, and commit). Each entry starts with a dash:

```yaml
- issue: 12
  parcel: "371000001"        # the right lot, 9 digits, in quotes
- issue: 13
  address: 2931 N Lawrence St  # or the right address
- issue: 15
  finished: 2025-06          # the right year and month
- issue: 14
  suppressed: true           # never shown, whatever the report says
  comment: why, for you only; never shown
- id: h2026_0001             # a project you add by hand
  kind: garden               # cleanup, garden, seating, art, trees, city_install, fix_311, other
  parcel: "371000002"
  finished: 2025-06
  group: Sample Block Club   # optional
  what_it_took: A few words  # optional
  source: https://...        # optional, a public page about it
```

A change to this file reaches the map at the next weekly update, or right away if you then run
**Publish approved projects** by hand (Actions tab, the workflow, "Run workflow").

Never write the name or contact details of a person in this file.

## What the map shows, and what it never shows

Shown: what was done, where (the lot, or a point for a bench at a stop), the month it was finished,
the group name if given, the note on what it took, and a link to the report on GitHub, where its
photos are.

Never shown: the GitHub user name of whoever sent it, the title of the report, any photo, the answer
about permission, or links, email addresses and phone numbers typed into the note.
