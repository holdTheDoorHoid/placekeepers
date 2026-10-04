"""Paths, the User-Agent, and run settings shared by every part of the pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from placekeepers import __version__

_SHORT_VERSION = ".".join(__version__.split(".")[:2])

USER_AGENT = f"Placekeepers/{_SHORT_VERSION} (+https://github.com/holdTheDoorHoid/placekeepers)"

# Philadelphia's clock. Build dates and record ages are counted in local days.
LOCAL_TZ = ZoneInfo("America/New_York")


class ConfigError(RuntimeError):
    """The pipeline cannot find its registry or cache."""


def find_repo_root(start: Path | None = None) -> Path:
    """Return the repository root: the nearest folder holding registry/sources.yaml.

    PK_REPO overrides the search. Otherwise we look upward from the working directory, then upward
    from this file, so the command works from anywhere inside a checkout or worktree.
    """
    env = os.environ.get("PK_REPO")
    if env:
        root = Path(env).expanduser().resolve()
        if not (root / "registry" / "sources.yaml").is_file():
            raise ConfigError(f"PK_REPO={env} has no registry/sources.yaml")
        return root
    starts = [start or Path.cwd(), Path(__file__).resolve()]
    for begin in starts:
        for candidate in [begin, *begin.parents]:
            if (candidate / "registry" / "sources.yaml").is_file():
                return candidate
    raise ConfigError(
        "Could not find the repository (a folder with registry/sources.yaml). "
        "Run pk from inside the Placekeepers checkout or set PK_REPO."
    )


def default_cache_root() -> Path:
    """The shared download cache: $PK_CACHE, or ~/.cache/placekeepers."""
    return Path(os.environ.get("PK_CACHE") or "~/.cache/placekeepers").expanduser()


def utc_now() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def iso_z(moment: datetime) -> str:
    """Format an aware datetime as 2026-10-05T10:03:12Z."""
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso_z(text: str) -> datetime:
    return datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)


def local_date(moment: datetime) -> date:
    return moment.astimezone(LOCAL_TZ).date()


@dataclass
class Settings:
    """Everything a run needs to know about where things live and how polite to be."""

    repo_root: Path
    cache_root: Path
    offline: bool = False
    keep_snapshots: int = 3
    duckdb_memory_limit: str = "1GB"
    duckdb_threads: int = 4
    # Fixed clock for tests and reproducible builds. None means the real clock.
    fixed_now: datetime | None = None
    extra: dict = field(default_factory=dict)

    @property
    def registry_dir(self) -> Path:
        return self.repo_root / "registry"

    def now(self) -> datetime:
        return self.fixed_now or utc_now()

    @classmethod
    def from_env(
        cls, *, repo_root: Path | None = None, cache_root: Path | None = None, offline: bool = False
    ) -> Settings:
        return cls(
            repo_root=repo_root or find_repo_root(),
            cache_root=cache_root or default_cache_root(),
            offline=offline,
            keep_snapshots=int(os.environ.get("PK_KEEP_SNAPSHOTS", "3")),
            duckdb_memory_limit=os.environ.get("PK_DUCKDB_MEMORY", "1GB"),
            duckdb_threads=int(os.environ.get("PK_DUCKDB_THREADS", "4")),
        )
