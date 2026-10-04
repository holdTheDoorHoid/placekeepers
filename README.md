# Placekeepers

A free map for Philadelphia neighbors and organizers who want to care for their blocks.

Find vacant lots and abandoned buildings, see who owns them and what they sold for over the years,
find the streets where people have been killed or badly hurt, and learn the legal way to clean and
green a lot, plant a tree, ask for traffic calming, or remember a neighbor. Every layer, score and
suggestion on the map can be switched on or off.

**Status:** being built. The first public release will cover the vacant lot finder with a detailed
page for every lot, and street safety with memorials. See the [roadmap](docs/ROADMAP.md).

## Why

Randomized trials in Philadelphia found that cleaning and greening vacant lots, and repairing the
doors and windows of abandoned houses, reduced gun violence nearby, cheaply, and most of all in the
poorest neighborhoods. Placekeepers helps people put that research to work, and is honest about what
the research does and does not show. Read [what the research says](docs/EVIDENCE.md).

## Built on Clean & Green Philly

Placekeepers revives and extends [Clean & Green Philly](https://github.com/CodeForPhilly/clean-and-green-philly),
built by Code for Philly volunteers from 2023 to 2025 (MIT license). That project stopped when the
City's vacancy data went bad in 2024. Placekeepers combines many City records so that no single
source can take it down, and adds sale history, street safety, memorials, and step by step legal
routes.

## Principles

- Care, not danger: the map shows where care helps most, never "dangerous neighborhoods".
- Honest evidence: every score says how strong the research behind it is.
- Legal route first: every suggestion starts with the lawful way to do it.
- Everything is a setting.
- Never go dark: if a data source breaks, the map keeps its last good copy and says so.
- Placekeeping: improve places for the people who live there now.

## Documents

| Document | What it covers |
|---|---|
| [Design](docs/DESIGN.md) | What we are building and why; the founding decisions |
| [Evidence](docs/EVIDENCE.md) | What the research supports, and what it does not |
| [Safeguards](docs/ETHICS.md) | Owner information, memorials, shootings, displacement, privacy |
| [Legal routes](docs/ROUTES.md) | Land access, permits, the intervention playbook, funding, partners |
| [Data sources](docs/DATA_SOURCES.md) | Every source, its status and its license |
| [Contracts](docs/CONTRACTS.md) | File formats shared by the data pipeline and the map |
| [Roadmap](docs/ROADMAP.md) | Phases, milestones, and what the owner needs to do |
| [Research](docs/research/) | The full research reports behind these documents |

## License

Code: GNU General Public License v3.0 (files adapted from Clean & Green Philly keep their MIT notice).
Published data: Open Database License where OpenStreetMap data is included, otherwise the source's
own terms. Written guides: Creative Commons Attribution ShareAlike 4.0.

Data comes from the City of Philadelphia and other public sources, credited on the map and in
[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md). Placekeepers is not affiliated with the City and is not
legal advice.
