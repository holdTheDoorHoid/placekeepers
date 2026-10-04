"""The `pk` command.

    pk registry check            check every registry file and cross reference
    pk fetch [ids...]            download sources into the cache
    pk validate [ids...]         turn new downloads into snapshots, or keep the last good one
    pk derive [--as-of DATE]     run the vacancy model on the current snapshots
    pk publish [--out DIR]       write manifest.json and the map layers
    pk health [ids...]           show each source's status
    pk all                       fetch, validate, run the vacancy model, publish, then show health

Common options: --sources a,b (limit to some sources), --offline (use only the cache),
--cache DIR (instead of $PK_CACHE), -v (more detail).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import date
from pathlib import Path

from placekeepers.config import ConfigError, Settings
from placekeepers.context import Context
from placekeepers.health import SourceStatus
from placekeepers.registry import RegistryError, load_registry
from placekeepers.runner import (
    StepResult,
    UsageError,
    all_statuses,
    derive_vacancy,
    fetch_source,
    ordered,
    select_sources,
    validate_source,
)

log = logging.getLogger("placekeepers")


def _ids(args: argparse.Namespace) -> list[str] | None:
    ids = list(getattr(args, "ids", None) or [])
    for chunk in getattr(args, "sources", None) or []:
        ids.extend(part.strip() for part in chunk.split(",") if part.strip())
    return ids or None


def _context(args: argparse.Namespace) -> Context:
    settings = Settings.from_env(
        cache_root=Path(args.cache).expanduser() if args.cache else None,
        offline=getattr(args, "offline", False),
    )
    registry = load_registry(settings.registry_dir, repo_root=settings.repo_root)
    return Context(settings, registry)


def _print_steps(results: list[StepResult]) -> None:
    for item in results:
        print(
            f"  {item.step:<9} {item.source:<24} {item.outcome:<11} {item.seconds:6.1f} s  "
            f"{item.detail}"
        )


def format_health(statuses: list[SourceStatus]) -> str:
    headers = ("source", "status", "rows", "newest", "last success", "stale since", "message")
    rows = []
    for status in statuses:
        rows.append(
            (
                status.id,
                status.status,
                f"{status.rows:,}" if status.rows is not None else "",
                status.newest_record or "",
                (status.last_success or "").replace("T", " ").replace("Z", " UTC"),
                status.stale_since or "",
                status.message or "",
            )
        )
    widths = [
        max(len(headers[i]), *(len(row[i]) for row in rows)) if rows else len(headers[i])
        for i in range(len(headers))
    ]
    lines = ["  ".join(headers[i].ljust(widths[i]) for i in range(len(headers))).rstrip()]
    lines.append("  ".join("-" * widths[i] for i in range(len(headers))))
    for row in rows:
        lines.append("  ".join(row[i].ljust(widths[i]) for i in range(len(headers))).rstrip())
    return "\n".join(lines)


# Commands
def cmd_registry_check(args: argparse.Namespace) -> int:
    settings = Settings.from_env(cache_root=Path(args.cache) if args.cache else None)
    registry = load_registry(settings.registry_dir, repo_root=settings.repo_root)
    print(f"The registry is valid: {registry.summary()}.")
    return 0


def cmd_fetch(args: argparse.Namespace) -> int:
    ctx = _context(args)
    try:
        sources = ordered(select_sources(ctx.registry, _ids(args)))
        if ctx.settings.offline:
            print("Offline: nothing downloaded.")
            return 0
        _print_steps([fetch_source(ctx, source, force=args.force) for source in sources])
    finally:
        ctx.close()
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    ctx = _context(args)
    sources = ordered(select_sources(ctx.registry, _ids(args)))
    _print_steps([validate_source(ctx, source) for source in sources])
    return 0


def _as_of(args: argparse.Namespace) -> date | None:
    return date.fromisoformat(args.as_of) if getattr(args, "as_of", None) else None


def cmd_derive(args: argparse.Namespace) -> int:
    ctx = _context(args)
    step = derive_vacancy(ctx, _as_of(args))
    _print_steps([step])
    return 0 if step.outcome == "ok" else 1


def _publish(ctx: Context, args: argparse.Namespace) -> int:
    from placekeepers.publish import publish

    as_of = date.fromisoformat(args.as_of) if args.as_of else None
    result = publish(ctx, Path(args.out), as_of=as_of)
    print(
        f"Published to {result.out_dir} in {result.seconds:.1f} s "
        f"(build {result.manifest['build_id']})."
    )
    for name, count in result.features.items():
        print(f"  {name}: {count:,} features")
    if result.dossiers is not None and result.dossiers.parcels:
        print(
            f"  dossiers: {result.dossiers.parcels:,} parcels in {result.dossiers.shards:,} files "
            f"({result.dossiers.bytes / 1e6:.1f} MB), {result.dossiers.owners_listed:,} owners "
            "listed with many vacant parcels"
        )
    for file in result.tiles_built:
        print(f"  built {file}")
    for note in result.manifest["notes"]:
        print(f"  note: {note}")
    return 0


def cmd_publish(args: argparse.Namespace) -> int:
    return _publish(_context(args), args)


def cmd_health(args: argparse.Namespace) -> int:
    ctx = _context(args)
    sources = select_sources(ctx.registry, _ids(args))
    statuses = all_statuses(ctx, sources)
    if args.json:
        data = {
            status.id: {**status.to_manifest(), "consecutive_failures": status.consecutive_failures}
            for status in statuses
        }
        print(json.dumps(data, indent=2))
    else:
        print(format_health(statuses))
    if args.strict and any(status.status != "ok" for status in statuses):
        return 1
    return 0


def cmd_all(args: argparse.Namespace) -> int:
    ctx = _context(args)
    started = time.monotonic()
    try:
        # Each source is downloaded and checked before the next, in an order where a source comes
        # after the ones its download needs (the vacancy candidates, for example).
        sources = ordered(select_sources(ctx.registry, _ids(args)))
        steps: list[StepResult] = []
        if ctx.settings.offline:
            print("Offline: using only what is already in the cache.")
        for source in sources:
            if not ctx.settings.offline:
                steps.append(fetch_source(ctx, source, force=args.force))
            steps.append(validate_source(ctx, source))
        steps.append(derive_vacancy(ctx, _as_of(args)))
        print("Steps:")
        _print_steps(steps)
        _publish(ctx, args)
        print()
        print(format_health(all_statuses(ctx)))
        print(f"\nFinished in {time.monotonic() - started:.1f} s.")
    finally:
        ctx.close()
    return 0


# Parser
def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--cache", help="cache folder (default: $PK_CACHE or ~/.cache/placekeepers)"
    )
    common.add_argument("-v", "--verbose", action="store_true", help="show more detail")

    filters = argparse.ArgumentParser(add_help=False)
    filters.add_argument(
        "--sources",
        action="append",
        metavar="IDS",
        help="comma separated source ids (default: all)",
    )

    offline = argparse.ArgumentParser(add_help=False)
    offline.add_argument(
        "--offline", action="store_true", help="use only the cache; download nothing"
    )

    force = argparse.ArgumentParser(add_help=False)
    force.add_argument(
        "--force",
        action="store_true",
        help="download even frozen sources and yearly ones fetched in the last 30 days",
    )

    out = argparse.ArgumentParser(add_help=False)
    out.add_argument("--out", default=None, help="data root to write (default: build/data)")
    out.add_argument("--as-of", help="build date for time windows, YYYY-MM-DD (default: today)")

    # Shared options live on each command (pk fetch -v), never on pk itself: argparse would let a
    # command's defaults overwrite them.
    parser = argparse.ArgumentParser(prog="pk", description="Placekeepers data pipeline")
    commands = parser.add_subparsers(dest="command", required=True)

    registry = commands.add_parser("registry", help="registry tools")
    registry_commands = registry.add_subparsers(dest="registry_command", required=True)
    check = registry_commands.add_parser("check", help="check the registry", parents=[common])
    check.set_defaults(func=cmd_registry_check)

    fetch = commands.add_parser(
        "fetch", help="download sources", parents=[common, filters, offline, force]
    )
    fetch.add_argument("ids", nargs="*", help="source ids (default: all)")
    fetch.set_defaults(func=cmd_fetch)

    validate = commands.add_parser(
        "validate",
        help="check new downloads and make snapshots",
        parents=[common, filters, offline],
    )
    validate.add_argument("ids", nargs="*", help="source ids (default: all)")
    validate.set_defaults(func=cmd_validate)

    derive = commands.add_parser(
        "derive", help="run the vacancy model on the current snapshots", parents=[common]
    )
    derive.add_argument("--as-of", help="build date for time windows, YYYY-MM-DD (default: today)")
    derive.set_defaults(func=cmd_derive)

    publish = commands.add_parser(
        "publish", help="write the published data", parents=[common, offline, out]
    )
    publish.set_defaults(func=cmd_publish)

    health = commands.add_parser(
        "health", help="show source health", parents=[common, filters, offline]
    )
    health.add_argument("ids", nargs="*", help="source ids (default: all)")
    health.add_argument("--json", action="store_true", help="print JSON")
    health.add_argument(
        "--strict", action="store_true", help="exit with status 1 when any source is not ok"
    )
    health.set_defaults(func=cmd_health)

    run_all = commands.add_parser(
        "all",
        help="fetch, validate, publish, report",
        parents=[common, filters, offline, force, out],
    )
    run_all.set_defaults(func=cmd_all)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if getattr(args, "out", "unset") is None:
        try:
            args.out = str(Settings.from_env().repo_root / "build" / "data")
        except ConfigError as exc:
            print(f"pk: {exc}", file=sys.stderr)
            return 2
    try:
        return args.func(args)
    except RegistryError as exc:
        print(f"The registry has {len(exc.problems)} problem(s):", file=sys.stderr)
        for problem in exc.problems:
            print(f"  {problem}", file=sys.stderr)
        return 1
    except (ConfigError, UsageError) as exc:
        print(f"pk: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        from placekeepers.publish import PublishError

        if isinstance(exc, PublishError):
            print(f"pk: {exc}", file=sys.stderr)
            return 1
        raise


if __name__ == "__main__":
    sys.exit(main())
