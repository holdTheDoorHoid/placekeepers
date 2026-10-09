# Placekeepers: rules for agents

Read before doing anything: `docs/DESIGN.md` (authoritative), `docs/ETHICS.md` (binding),
`docs/CONTRACTS.md` (file formats), your milestone's GitHub issue, and "How work is done" in
`docs/ROADMAP.md`.

## The owner

- The owner is not a programmer. Report decisions in plain language: lead with what they will see on
  the map, then why. Code details go in footnotes, if at all.
- **No dashes as punctuation** anywhere people read: interface text, docs, comments written for
  people, and commit messages. No em dashes, no en dashes, no spaced hyphens. Rewrite with a comma, a
  colon, parentheses, or a new sentence. Hyphens inside compound words, identifiers, command flags,
  and file names are fine. Write ranges as "2019 to 2024".
- The founding decisions in DESIGN.md section 2 belong to the owner. Do not reopen them. If you hit a
  real conflict, stop and report it.

## Data rules

- Every source needs a `registry/sources.yaml` entry with license and attribution. Every layer needs
  a `registry/layers.yaml` entry with a plain description; nothing reaches the map without a toggle.
- Send a descriptive User-Agent on every request:
  `Placekeepers/<version> (+https://github.com/holdTheDoorHoid/placekeepers)`.
  Some servers (philart.net) need a browser style User-Agent; note it in the adapter.
- Never get around a login, paywall, bot check, robots rule, or HTTP 403. Never scrape Mural Arts,
  Walk Score, the Public Art Archive, commercial crime sites, or Reddit (see DATA_SOURCES.md). Never use
  Build Philly Now's map, tiles or API as a source: go to the City's own data it is built on.
- Bulk OpenStreetMap data comes from a Geofabrik extract, not the public Overpass server.
- Names of people killed come only from `data/curated/memorials.yaml`, edited by hand from public
  memorial lists. Never scrape names. Never publish driver details, case numbers, arrest information,
  or the race, age or sex of individual victims.
- Owner flag wording comes from ETHICS.md, word for word.
- Never suggest police enforcement. 311 suggestions are for physical conditions only.
- Raw downloads go to `$PK_CACHE` (default `~/.cache/placekeepers`), shared across worktrees. Check
  `df -h /` before any download over 100 MB and keep at least 10 GB free. Never commit raw data or
  build outputs.

## Engineering conventions

- Pipeline: Python 3.12 in `pipeline/`, virtual environment at `pipeline/.venv`, installed with
  `pip install -e "pipeline[dev]"`. DuckDB with the spatial extension, GeoPandas, pyarrow, h3, httpx,
  PyYAML. Tests with pytest on small fixtures in `pipeline/tests/fixtures/`; unit tests never use the
  network. Lint with ruff.
- Web: Node 24 and npm in `web/`. Svelte 5, Vite, TypeScript, MapLibre GL JS, pmtiles. Tests with
  vitest. All interface text lives in one strings module.
- Map tiles: tippecanoe. If it is not installed locally (it may not be yet; installing it is an owner
  action), write GeoJSON, skip the tile step with a clear message, and let CI build tiles.
- Code adapted from Clean & Green Philly (MIT) keeps its copyright notice in the file header and is
  listed in `NOTICE`.

## Git and process

- Work only in your own worktree, `~/Desktop/placekeepers-wt/<name>`, on branch `agent/<name>`.
- Commit often with plain language messages (no dashes as punctuation), ending with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Never push, open pull requests, create repositories, or change repository settings. The orchestrator
  reviews, merges and pushes.
- Finish with a short report: what you built, what the owner will see, test results, anything you
  could not do, and any change you made to a contract.

## Machine limits

The laptop has 8 cores and 15 GB of memory, often with only about 3 GB free, and about 20 GB of free
disk. At most three agents build at once. Avoid running several heavy jobs at the same time.
