"""Did it work? (M5.4, issue #48): the method on synthetic cities where the truth is known, the
verdict rules, the readers of every input, `pk didit`, the weekly copy into tables/didit.json, and
the check that every published number is reproduced from the committed per area totals."""

from __future__ import annotations

import dataclasses
import json
from datetime import date
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import Point, box

from placekeepers import cli
from placekeepers.didit import method as m
from placekeepers.didit import study
from placekeepers.didit.synthetic import N_HALVES, simulate
from placekeepers.publish.didit import DIDIT_TABLE, build_didit, projects_now, ready_before

from .conftest import REPO_ROOT, install_snapshot

SEEDS = range(8)


def _run(seed: int, effect: float, **how) -> tuple[m.Estimate, m.Estimate, float]:
    places, counts, _ = simulate(seed, effect, **how)
    sets = m.match(places, counts, 0, N_HALVES - 1)
    placebo = m.match(places, counts, 0, N_HALVES - 1, shift=m.PLACEBO_SHIFT)
    return (
        m.estimate_sets(sets, draws=400, seed=seed),
        m.estimate_sets(placebo, draws=400, seed=seed),
        m.naive_before_after(sets),
    )


@pytest.fixture(scope="module")
def random_care() -> dict[float, list]:
    return {effect: [_run(s, effect, need=0.0) for s in SEEDS] for effect in (0.0, -0.2)}


@pytest.fixture(scope="module")
def targeted_care() -> dict[float, list]:
    return {effect: [_run(s, effect) for s in SEEDS] for effect in (0.0, -0.2)}


def _mean(runs, index=0) -> float:
    return float(np.mean([r[index].percent for r in runs]))


def _covers(runs, truth: float) -> int:
    return sum(r[0].low <= truth <= r[0].high for r in runs)


# The method on synthetic cities


def test_recovers_a_known_effect(random_care, targeted_care) -> None:
    # Care given at random, and care given where events and poverty were higher (what the
    # matching sees): the average estimate is within two points of the true 20 percent drop, and
    # the 90 percent interval holds the truth in most cities.
    assert abs(_mean(random_care[-0.2]) + 20) < 2
    assert abs(_mean(targeted_care[-0.2]) + 20) < 2.5
    assert _covers(random_care[-0.2], -20) >= 7
    assert _covers(targeted_care[-0.2], -20) >= 6


def test_finds_nothing_when_there_is_nothing(random_care, targeted_care) -> None:
    assert abs(_mean(random_care[0.0])) < 2
    assert abs(_mean(targeted_care[0.0])) < 2
    assert _covers(random_care[0.0], 0) >= 7
    assert _covers(targeted_care[0.0], 0) >= 6


def test_a_simple_before_and_after_is_fooled_where_the_comparison_is_not(targeted_care) -> None:
    # Care that goes where events were high is followed by fewer events anyway (regression to the
    # mean) or, here, by more as the citywide wave passes: the before and after misses the truth
    # by several points; the comparison does not.
    naive = float(np.mean([r[2] for r in targeted_care[0.0]]))
    assert abs(naive) > 4
    assert abs(_mean(targeted_care[0.0])) < 2


def test_the_placebo_passes_when_care_is_random(random_care) -> None:
    passed = sum(r[1].low <= 0 <= r[1].high for r in random_care[0.0])
    assert passed >= 6


def test_the_placebo_catches_hidden_differences() -> None:
    # When care follows a lasting difference the matching cannot see, the main estimate is wrong
    # (an effect where there is none) and the placebo says so in every city.
    runs = [_run(s, 0.0, hidden=1.0) for s in range(4)]
    assert _mean(runs) > 5
    assert all(not (r[1].low <= 0 <= r[1].high) for r in runs)


def test_count_near_counts_by_ring_and_half() -> None:
    px, py = np.array([0.0, 1000.0]), np.array([0.0, 0.0])
    ex = np.array([0.0, 150.0, 199.0, 250.0, 399.0, 401.0, 1000.0, 0.0])
    ey = np.zeros(8)
    eh = np.array([0, 0, 1, 1, 2, 2, 0, 9])  # the last is outside the halves counted
    c = m.count_near(px, py, ex, ey, eh, 3, (200.0, 400.0))
    assert c[0, :, 0].tolist() == [2, 1, 0]
    assert c[0, :, 1].tolist() == [0, 1, 1]
    assert c[1, :, 0].tolist() == [1, 0, 0]
    assert c[1, :, 1].tolist() == [0, 0, 0]


def test_bootstrap_draws_never_change() -> None:
    # The raw PCG64 stream is stable across numpy versions; if this ever fails, the published
    # intervals would no longer reproduce.
    assert m.draws_index(7, 3, 1).tolist() == [
        [2, 5, 4, 5, 1, 6, 5],
        [3, 1, 3, 6, 0, 4, 2],
        [3, 5, 0, 1, 6, 2, 1],
    ]


def test_totals_reproduce_the_estimate_exactly() -> None:
    places, counts, _ = simulate(3, -0.1)
    sets = m.match(places, counts, 0, N_HALVES - 1)
    direct = m.estimate_sets(sets, draws=300)
    rows = study._anonymous_rows("landcare", "shootings", "main", m.totals(sets))
    again = study.read_totals(study.totals_csv(rows))[("landcare", "shootings", "main")]
    assert m.estimate(again, draws=300) == direct
    # The comparison places' averages times 60 are whole numbers.
    assert (m.totals(sets).c_pre >= 0).all()
    assert m.SCALE % np.lcm.reduce(np.arange(1, m.K + 1)) == 0


def _est(places=500, areas=30, percent=-5.0, low=-9.0, high=-1.0) -> dict:
    return {"places": places, "areas": areas, "percent": percent, "low": low, "high": high}


@pytest.mark.parametrize(
    ("main", "placebo", "expected"),
    [
        (_est(), _est(low=-3, high=4), ("fewer", "passed")),
        (_est(percent=6, low=2, high=9), _est(low=-3, high=4), ("more", "passed")),
        (_est(low=-9, high=2), _est(low=-3, high=4), ("no_clear_change", "passed")),
        (_est(), _est(low=1, high=9), ("check_failed", "failed")),
        (_est(), _est(places=60, low=1, high=9), ("fewer", "too_few")),
        (_est(places=80), _est(low=-3, high=4), ("too_few", "passed")),
        (_est(areas=12), _est(low=-3, high=4), ("too_few", "passed")),
        (
            _est(places=0, percent=None, low=None, high=None),
            _est(places=0, low=None, high=None),
            ("too_few", "too_few"),
        ),
    ],
)
def test_verdict_rules(main, placebo, expected) -> None:
    assert study.verdict(main, placebo) == expected


def test_first_full_half_and_labels() -> None:
    assert study.first_full_half(date(2015, 1, 2), 24) == 0  # complaints, after the holiday
    assert study.first_full_half(date(2016, 1, 10), 24) == 3  # dumping, a partial January
    assert study.first_full_half(date(2015, 7, 1), 24) == 1
    assert study.half_label(4) == "2017-1" and study.half_label(5) == "2017-2"
    assert study.half_end(22) == date(2026, 6, 30)


def test_only_complaints_about_vacant_property_count() -> None:
    assert study.complaint_counts("VACANT LOTS (CLIP)")
    assert study.complaint_counts("VACANT PROPERTY COMPLAINT")
    assert study.complaint_counts("vacant house")
    assert not study.complaint_counts("VACANT STRATEGY INSPECTIONS")
    assert not study.complaint_counts("PROPERTY MAINTENANCE HIGH WEEDS")
    assert not study.complaint_counts(None)


# Every input, read end to end through pk didit

ORIGIN = (-75.16, 39.99)
METERS_PER_DEGREE = (85_400.0, 111_000.0)


def _ll(dx: float, dy: float) -> tuple[float, float]:
    return ORIGIN[0] + dx / METERS_PER_DEGREE[0], ORIGIN[1] + dy / METERS_PER_DEGREE[1]


def _square(dx: float, dy: float, half: float = 5.0) -> bytes:
    lng0, lat0 = _ll(dx - half, dy - half)
    lng1, lat1 = _ll(dx + half, dy + half)
    return shapely.to_wkb(box(lng0, lat0, lng1, lat1))


def _points(rows: list[dict], day_column: str, **extra: list) -> pa.Table:
    lng = [_ll(r["x"], r["y"])[0] for r in rows]
    lat = [_ll(r["x"], r["y"])[1] for r in rows]
    cols = {day_column: pa.array([r["day"] for r in rows], pa.date32()), "lat": lat, "lng": lng}
    cols.update(extra)
    return pa.table(cols)


@pytest.fixture
def didit_cache(context_factory):
    """A small city: two LandCare lots with dates (spring 2019, fall 2019), one without, clean and
    seal orders in each status, demolitions by the City and not, events of each outcome, one tract
    and vacant lots and buildings today."""
    ctx = context_factory()
    at = "2026-10-21T10:00:00Z"
    landcare = pa.table(
        {
            "year": ["2019", "2019", "2021", " "],
            "season": ["Spring", "Fall", "WINTER", " "],
            "program": ["PLC", "PLC", "CLC", "CLC"],
            "geometry": [_square(0, 0), _square(2000, 0), _square(0, 2000), _square(2000, 2000)],
        }
    )
    install_snapshot(ctx, "phs_landcare", landcare, geometry=True, fetched_at=at)
    seal_days = [date(2018, 3, 1), date(2018, 3, 1), date(2018, 8, 1), date(2018, 8, 1)]
    clean_seal = _points(
        [{"x": 1000, "y": 0, "day": d} for d in seal_days],
        "workordercompleteddate",
        casecompleteddate=pa.array([None] * 4, pa.date32()),
        workorderstatus=["Approved", "CANCELLED", "CLOSED", "Waived"],
    )
    install_snapshot(ctx, "li_clean_and_seal", clean_seal, geometry=False, fetched_at=at)
    demolitions = _points(
        [
            {"x": 3000, "y": 0, "day": date(2020, 2, 1)},
            {"x": 3000, "y": 1000, "day": date(2020, 2, 1)},
        ],
        "completed_date",
        city_demo=["YES", "NO"],
        status=["COMPLETED", "COMPLETED"],
        typeofwork=["CASE", "FULL"],
    )
    install_snapshot(ctx, "li_demolitions", demolitions, geometry=False, fetched_at=at)
    shootings = _points(
        [
            {"x": 50, "y": 0, "day": date(2015, 1, 1)},
            {"x": 0, "y": 150, "day": date(2017, 5, 1)},
            {"x": 0, "y": 300, "day": date(2017, 5, 1)},
            {"x": 0, "y": 0, "day": date(2026, 10, 1)},
        ],
        "date_",
    )
    install_snapshot(ctx, "shootings", shootings, geometry=False, fetched_at=at)
    dumping = _points(
        [
            {"x": 0, "y": 0, "day": date(2016, 1, 10)},
            {"x": 0, "y": 120, "day": date(2018, 2, 1)},
            {"x": 10, "y": 10, "day": date(2018, 2, 1)},
            {"x": 0, "y": 0, "day": date(2026, 10, 20)},
        ],
        "requested",
    )
    install_snapshot(ctx, "philly311_dumping_history", dumping, geometry=False, fetched_at=at)
    complaints = _points(
        [
            {"x": 0, "y": 150, "day": date(2015, 1, 2)},
            {"x": 0, "y": 150, "day": date(2017, 1, 5)},
            {"x": 0, "y": 160, "day": date(2017, 1, 5)},
            {"x": 0, "y": 0, "day": date(2026, 10, 21)},
        ],
        "complaintdate",
        complaintcodename=[
            "VACANT HOUSE",
            "VACANT LOT",
            "VACANT STRATEGY INSPECTIONS",
            "VACANT LOT",
        ],
    )
    install_snapshot(ctx, "li_complaints_history", complaints, geometry=False, fetched_at=at)
    lng0, lat0 = _ll(-5000, -5000)
    lng1, lat1 = _ll(8000, 8000)
    tracts = pa.table(
        {"geoid": ["42101000100"], "geometry": [shapely.to_wkb(box(lng0, lat0, lng1, lat1))]}
    )
    install_snapshot(ctx, "census_tracts_2020", tracts, geometry=True, fetched_at=at)
    install_snapshot(
        ctx,
        "acs_poverty",
        pa.table({"geoid": ["42101000100"], "poverty_pct": [31.5]}),
        geometry=False,
        fetched_at=at,
    )
    vacancy = pa.table(
        {
            "kind": ["lot", "lot", "building", "lot"],
            "confidence": ["high", "low", "medium", "high"],
            "in_landcare": [False, False, False, True],
            "geometry": [
                shapely.to_wkb(Point(*_ll(x, y)))
                for x, y in ((500, 500), (600, 600), (700, 700), (800, 800))
            ],
        }
    )
    derived = ctx.cache.root / "derived"
    derived.mkdir(parents=True, exist_ok=True)
    pq.write_table(vacancy, derived / "vacancy.parquet")
    return ctx


def _inputs(ctx, projects: Path | None = None) -> study.Inputs:
    from placekeepers.derive.lenses import current_snapshot

    return study.Inputs(
        paths={part: current_snapshot(ctx, source) for part, source in study.SOURCES.items()},
        vacancy=ctx.cache.root / "derived" / "vacancy.parquet",
        projects=projects,
    )


def test_every_input_is_read_as_the_study_says(didit_cache, tmp_path) -> None:
    projects = tmp_path / "projects.json"
    projects.write_text(
        json.dumps(
            {
                "projects": [
                    {
                        "id": "r1",
                        "finished": "2024-05",
                        "lat": _ll(4000, 0)[1],
                        "lng": _ll(4000, 0)[0],
                    }
                ]
            }
        )
    )
    built = study.build(_inputs(didit_cache, projects))
    lc = built.care["landcare"]
    assert (lc["records"], lc["dated"], lc["undated"]) == (4, 2, 2)  # winter and blank undated
    lc_places = built.places["landcare"]
    halves = sorted(int(h) for h in np.nonzero(lc_places.care)[1])
    assert halves == [8, 9]  # spring 2019 is the first half of 2019, fall the second
    assert lc_places.undated.sum() == 2
    # Clean and seal: only the approved and closed orders count, one in each half of 2018.
    assert built.care["clean_seal"]["records"] == 2
    assert sorted(np.nonzero(built.places["clean_seal"].care)[1].tolist()) == [6, 7]
    # Demolitions: only the City's.
    assert built.care["demolition"]["records"] == 1
    assert built.care["projects"]["records"] == 1 and built.care["projects"]["read"]
    # The data: the last half every outcome covers in full is the first half of 2026; dumping
    # starts in a partial January, so its first full half is the second half of 2016.
    assert built.last_half == 22
    assert built.first_half == {"shootings": 0, "dumping": 3, "complaints": 0}
    # Counts near the LandCare lot at the origin (its square's center is 50 m from the origin).
    i = int(np.flatnonzero(lc_places.care[:, 8])[0])
    near = built.outcomes["landcare"]
    assert near["shootings"][i, 0] == 1 and near["shootings"][i, 4] == 1
    assert near["shootings_ring"][i, 4] == 1  # the one 300 m away is in the ring
    # Dumping and complaints leave out the place's own square: the report at (10, 10) is not
    # counted, the one 120 m away is; the inspection program never counts.
    assert near["dumping"][i, 6] == 1
    assert near["complaints"][i, 0] == 1 and near["complaints"][i, 4] == 1
    # Poverty comes from the tract around each place.
    assert np.allclose(lc_places.poverty, 31.5)


def test_pk_didit_writes_results_that_reproduce(didit_cache, tmp_path) -> None:
    root = tmp_path / "out"
    code = cli.main(
        [
            "didit",
            "--cache",
            str(didit_cache.cache.root),
            "--root",
            str(root),
            "--as-of",
            "2026-10-21",
            "--draws",
            "50",
        ]
    )
    assert code == 0
    results = json.loads((root / study.RESULTS_FILE).read_text())
    totals = (root / study.TOTALS_FILE).read_text()
    assert results["schema"] == 1 and results["generated"] == "2026-10-21"
    assert results["data_through"] == "2026-06-30"
    assert [k["id"] for k in results["kinds"]] == list(study.KINDS)
    for kind in results["kinds"]:
        assert [r["outcome"] for r in kind["results"]] == list(study.OUTCOMES)
        for r in kind["results"]:
            assert r["verdict"] == "too_few"  # a handful of places is never enough
    assert study.reproduce(results, totals) == []
    assert not (root / "build").exists()


def test_pk_didit_says_what_is_missing(context_factory, tmp_path, capsys) -> None:
    ctx = context_factory()
    code = cli.main(["didit", "--cache", str(ctx.cache.root), "--root", str(tmp_path)])
    assert code == 1
    assert "pk fetch" in capsys.readouterr().err


# The published results

RESULTS = REPO_ROOT / study.RESULTS_FILE
TOTALS = REPO_ROOT / study.TOTALS_FILE


def test_every_published_number_is_reproduced_from_the_committed_totals() -> None:
    # The numbers on the page "Did it work?" come from data/didit/results.json; this recomputes
    # every one of them, intervals included, from data/didit/totals.csv.
    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    assert study.reproduce(results, TOTALS.read_text(encoding="utf-8")) == []


def test_the_published_results_name_no_place() -> None:
    text = RESULTS.read_text(encoding="utf-8") + TOTALS.read_text(encoding="utf-8")
    for word in ("lat", "lng", "address", "parcel", "opa", "geometry", "h3"):
        assert f'"{word}"' not in text
    header = TOTALS.read_text(encoding="utf-8").splitlines()[0].split(",")
    assert header == list(study.TOTALS_COLUMNS)


def test_the_published_results_follow_the_contract() -> None:
    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    assert results["schema"] == 1
    assert set(results["rules"]) == {"min_places", "min_areas", "min_placebo"}
    verdicts = {"too_few", "check_failed", "fewer", "more", "no_clear_change"}
    for kind in results["kinds"]:
        assert kind["id"] in study.KINDS
        for r in kind["results"]:
            assert r["verdict"] in verdicts and r["check"] in {"passed", "failed", "too_few"}
            for comparison in ("main", "around", "later", "placebo"):
                assert set(r[comparison]) == {
                    "places",
                    "areas",
                    "before",
                    "after",
                    "expected",
                    "percent",
                    "low",
                    "high",
                    "per_place_year",
                    "per_low",
                    "per_high",
                    "balance",
                }


# The weekly copy


def test_publish_copies_the_results_and_counts_this_weeks_projects(context_factory, tmp_path):
    repo = tmp_path / "repo"
    (repo / "data" / "didit").mkdir(parents=True)
    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    (repo / study.RESULTS_FILE).write_text(json.dumps(results))
    ctx = context_factory()
    ctx.settings = dataclasses.replace(ctx.settings, repo_root=repo)
    out = tmp_path / "staging"
    (out / "tables").mkdir(parents=True)
    limit = ready_before(results)
    (out / "tables" / "projects.json").write_text(
        json.dumps(
            {
                "projects": [
                    {"id": "a", "finished": "2019-04"},
                    {"id": "b", "finished": limit},
                    {"id": "c", "finished": "2026-05"},
                ]
            }
        )
    )
    found = build_didit(ctx, out, date(2026, 10, 26))
    assert found.written and not found.notes
    table = json.loads((out / DIDIT_TABLE).read_text())
    assert table["projects_now"] == {
        "as_of": "2026-10-26",
        "shown": 3,
        "ready": 2,
        "ready_before": limit,
    }
    assert table["kinds"] == results["kinds"]


def test_publish_without_results_says_so(context_factory, tmp_path) -> None:
    ctx = context_factory()
    ctx.settings = dataclasses.replace(ctx.settings, repo_root=tmp_path)
    found = build_didit(ctx, tmp_path / "staging", date(2026, 10, 26))
    assert not found.written
    assert found.notes == ["Did it work?: no results yet; run pk didit to make them"]


def test_ready_before_leaves_two_full_years() -> None:
    assert ready_before({"data_through": "2026-06-30"}) == "2024-06"
    assert ready_before({"data_through": "2026-12-31"}) == "2024-12"
    assert projects_now({"data_through": "2026-06-30"}, Path("/nonexistent"), date.today()) is None
