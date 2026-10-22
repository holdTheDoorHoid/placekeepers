"""Shared paths for the "Did it work?" study (milestone M5.4, issue #48).

Research code, not pipeline code: it runs the pipeline's own study (placekeepers.didit) on the
snapshots in the shared cache (~/.cache/placekeepers/snapshots) and keeps small result tables in
research/didit/results/. Nothing here downloads anything: the two outcome histories the study added
are registry sources (`philly311_dumping_history`, `li_complaints_history`), fetched with `pk fetch`.
"""

from __future__ import annotations

import os
from pathlib import Path

CACHE = Path(os.environ.get("PK_CACHE", Path.home() / ".cache" / "placekeepers"))
DERIVED = CACHE / "derived"
HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"

RESULTS.mkdir(parents=True, exist_ok=True)
