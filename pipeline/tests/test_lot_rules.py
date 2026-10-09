"""The rules and records of each lot (M4.6, issue #42): historic districts and the Register, zoning
overlays and the base district, brownfield properties, appeals and hearings, from their sources to
the map layers and the lot dossiers. And the owner's decision of 2026-10-09 (docs/ETHICS.md,
"Appeals and hearings"): who filed an appeal and the owner the City names appear on that lot's own
page, and in no citywide file, map layer or table."""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

import httpx
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import Point, box

from placekeepers.adapters import ADAPTERS
from placekeepers.adapters.rules import APPEAL_COLUMNS
from placekeepers.derive import lot_rules as lr
from placekeepers.derive.appeals import is_upcoming
from placekeepers.publish import publish

from . import rules_fixtures as rf
from .conftest import FakeCarto
from .test_dossiers import NOW, install_everything
from .test_sources import carto_rows, fake_layer, relaxed, run

TODAY = date(2026, 10, 9)


# Reading the Commission's dates and the Planning Commission's overlays
def test_designation_days_skip_placeholders_and_typos() -> None:
    assert lr.city_day("6/24/1958", TODAY) == "1958-06-24"
    assert lr.city_day("1/1/3000", TODAY) is None
    assert lr.city_day("12/11/2105", TODAY) is None
    assert lr.city_day("2/30/2001", TODAY) is None
    assert lr.city_day(None, TODAY) is None
    # The district's text wins over its stored date, which holds 3000-01-01 where the text is
    # right (Powelton Village, designated 11/10/2022).
    from datetime import datetime

    assert lr.district_day("11/10/2022", datetime(3000, 1, 1, 5), TODAY) == "2022-11-10"
    assert lr.district_day(None, datetime(2003, 12, 21, 5), TODAY) == "2003-12-21"
    assert lr.district_day("1/1/3000", datetime(3000, 1, 1, 5), TODAY) is None


def test_overlays_keep_their_words_their_code_link_and_a_pending_bill() -> None:
    from datetime import datetime

    row = {
        "overlay_name": " /VDO - Example  Subarea ",
        "overlay_symbol": "/VDO",
        "type": "Overlay District",
        "code_section": "14-529",
        "code_section_link": "https://codelibrary.amlegal.com/x",
        "sunset_date": datetime(2029, 1, 1, 5),
        "pending": "Yes",
        "pendingbill": "260462",
        "pendingbillurl": "https://phila.legistar.com/x",
    }
    record = lr.overlay_record(row, TODAY)
    assert record == {
        "id": record["id"],
        "name": "/VDO - Example Subarea",
        "symbol": "/VDO",
        "type": 1,
        "section": "14-529",
        "link": "https://codelibrary.amlegal.com/x",
        "sunset": "2029-01-01",
        "pending_bill": "260462",
        "pending_url": "https://phila.legistar.com/x",
    }
    assert re.fullmatch(r"o[0-9a-f]{8}", record["id"])
    # The key stays the same while the Commission keeps the overlay's words.
    assert lr.overlay_record(dict(row, pending="No"), TODAY)["id"] == record["id"]
    supplemental = lr.overlay_record(
        dict(row, overlay_symbol="[N/A]", type="Supplemental Control", pending="No"), TODAY
    )
    assert "symbol" not in supplemental and "pending_bill" not in supplemental
    assert supplemental["type"] == 2


def test_the_join_by_shape() -> None:
    """A district covering a lot's point, or a tenth of its shape, applies; a sliver does not. The
    Register by the lot's point. Brownfield properties within 100 meters, the nearest three
    listed and the rest counted."""
    lot = box(0, 0, 0.0002, 0.0002)
    sets = lr.RuleSets(
        districts=[box(-1, -1, 0.0001, 1), box(0.00019, -1, 1, 1)],
        district_records=[{"name": "Covers the point"}, {"name": "A sliver"}],
        sites=[box(0, 0, 0.0002, 0.0002)],
        site_records=[{"address": "1 EXAMPLE ST", "date": "1958-06-24"}],
        overlays=[box(-1, -1, 0.00003, 1)],
        overlay_ids=["o00000001"],
        zoning=[box(-1, -1, 1, 1)],
        zoning_records=[{"code": "RSA-5"}],
        brownfields=[
            lr.to_meters(Point(0.0002 + 50 / lr.M_PER_DEG_LNG * (i + 1) / 5, 0.0001))
            for i in range(5)
        ]
        + [lr.to_meters(Point(0.01, 0.0001))],
        brownfield_records=[{"id": str(i)} for i in range(6)],
    )
    found = lr.lot_rules(["111111111", "222222222"], {"111111111": lot}, {}, sets)
    assert list(found) == ["111111111"]
    rules = found["111111111"]
    assert [d["name"] for d in rules["historic"]["districts"]] == ["Covers the point"]
    assert rules["historic"]["register"] == {"address": "1 EXAMPLE ST", "date": "1958-06-24"}
    # 15 percent of the lot lies in the overlay, away from its point: it applies.
    assert rules["overlays"] == ["o00000001"]
    assert rules["zoning"] == {"code": "RSA-5"}
    assert [b["id"] for b in rules["brownfields"]] == ["0", "1", "2"]
    assert [b["m"] for b in rules["brownfields"]] == sorted(b["m"] for b in rules["brownfields"])
    assert rules["brownfields_more"] == 2
    assert list(rules) == ["historic", "zoning", "overlays", "brownfields", "brownfields_more"]


# The sources
def test_the_epa_layer_is_a_map_service_asked_only_for_philadelphia(context_factory) -> None:
    fake = fake_layer("epa_brownfields")
    ctx = context_factory(handler=fake, now=NOW)
    run(ctx, relaxed(ctx.registry.sources["epa_brownfields"]))
    paths = {r.url.path for r in fake.requests}
    assert all("/OEI/FRS_INTERESTS/MapServer/0" in path for path in paths)
    queries = [r for r in fake.requests if r.url.path.endswith("/query")]
    assert all(
        r.url.params["where"] == "STATE_CODE='PA' AND COUNTY_NAME='PHILADELPHIA'" for r in queries
    )
    assert {r.url.host for r in fake.requests} == {"geodata.epa.gov"}


def test_the_epa_layer_is_asked_again_when_its_server_loses_it(
    context_factory, monkeypatch
) -> None:
    """The EPA's server sometimes answers "Service not found" with HTTP 404 and an HTML page."""
    monkeypatch.setattr(ADAPTERS["epa_brownfields"], "pause", 0.0)
    layer = fake_layer("epa_brownfields")
    misses = {"left": 2}

    def flaky(request: httpx.Request) -> httpx.Response:
        if misses["left"]:
            misses["left"] -= 1
            return httpx.Response(404, text="<html>Error: Service not found</html>")
        return layer(request)

    ctx = context_factory(handler=flaky, now=NOW)
    meta = run(ctx, relaxed(ctx.registry.sources["epa_brownfields"])).current()
    assert meta.rows == 3 and misses["left"] == 0


def test_appeals_never_ask_for_the_grounds_or_numbers_of_other_files(context_factory) -> None:
    adapter = ADAPTERS["appeals"]
    ctx = context_factory(now=NOW)
    source = relaxed(ctx.registry.sources["appeals"])
    fake = FakeCarto(tables={"appeals": carto_rows(adapter, 3)})
    ctx = context_factory(handler=fake, now=NOW)
    store = run(ctx, source)
    for query in fake.queries:
        for never in ("appealgrounds", "proviso", "relatedpermit", "relatedcasefile", "posse"):
            assert never not in query
    columns = set(pq.read_schema(store.path_for(store.current())).names)
    assert set(APPEAL_COLUMNS) <= columns


# The build
@pytest.fixture
def built(context_factory, tmp_path) -> Path:
    ctx = context_factory(now=NOW)
    install_everything(ctx)
    rf.install_rules(ctx)
    out = tmp_path / "data"
    publish(ctx, out)
    return out


def files_under(out: Path) -> dict[str, str]:
    return {
        str(path.relative_to(out)): path.read_text(encoding="utf-8")
        for path in sorted(out.rglob("*"))
        if path.is_file()
    }


def layer(out: Path, name: str) -> list[dict]:
    body = json.loads((out / "tiles" / f"rules.{name}.geojson").read_text(encoding="utf-8"))
    return [feature["properties"] for feature in body["features"]]


def parcel(out: Path, account: str) -> dict:
    body = json.loads((out / "dossiers" / f"{account[:4]}.json").read_text(encoding="utf-8"))
    return body["parcels"][account]


def test_the_map_layers(built: Path) -> None:
    districts = layer(built, "historic_districts")
    assert {
        "id": "fixture_hill_historic_district",
        "nm": rf.DISTRICT,
        "dd": "2003-12-21",
    } in districts
    # 1/1/3000 is no date.
    assert {
        "id": "example_row_historic_district",
        "nm": "Example Row Historic District",
    } in districts
    sites = layer(built, "historic_sites")
    assert {
        "ad": "2931 N LAWRENCE ST",
        "d": "1958-06-24",
        "dn": rf.DISTRICT,
        "dd": "2003-12-21",
    } in sites
    overlays = {o["nm"]: o for o in layer(built, "overlays")}
    assert overlays[rf.PENDING]["pb"] == "260462" and overlays[rf.PENDING]["su"] == "2029-01-01"
    assert "sy" not in overlays[rf.WISSAHICKON] and overlays[rf.WISSAHICKON]["t"] == 3
    hearings = layer(built, "hearings")
    # Only hearings still to come, each with its day and time in Philadelphia.
    assert [(h.get("id"), h["d"], h.get("tm"), h["b"]) for h in hearings] == [
        ("371000001", "2026-11-04", "09:00", 1),
        (rf.NEIGHBOR, "2026-12-02", "14:00", 1),
    ]
    assert hearings[0]["rco"] == "Fixture Neighbors Association"
    for hearing in hearings:
        assert set(hearing) <= {"id", "d", "tm", "b", "ty", "ad", "rco"}
    brownfields = layer(built, "brownfields")
    assert {
        "id": "110000000000",
        "nm": "FORMER EXAMPLE WORKS",
        "ad": "2914 N 5TH ST",
    } in brownfields
    # The lots layer marks lots at or near a brownfield property.
    lots = json.loads((built / "tiles" / "lots.parcels.geojson").read_text(encoding="utf-8"))
    marked = {f["properties"]["id"] for f in lots["features"] if f["properties"].get("bf") == 1}
    assert "372000005" in marked and "371000001" not in marked


def test_the_lot_dossiers(built: Path) -> None:
    lawrence = parcel(built, "371000001")
    assert lawrence["rules"]["historic"] == {
        "districts": [{"name": rf.DISTRICT, "date": "2003-12-21"}],
        "register": {
            "address": "2931 N LAWRENCE ST",
            "date": "1958-06-24",
            "district": rf.DISTRICT,
            "district_date": "2003-12-21",
        },
    }
    assert lawrence["rules"]["zoning"] == {
        "code": "RSA-5",
        "group": "Residential/Multi-Family/Residential Mixed-Use",
    }
    common = json.loads((built / "dossiers" / "common.json").read_text(encoding="utf-8"))
    assert [common["overlays"][key]["name"] for key in lawrence["rules"]["overlays"]] == [rf.NCO]
    # On the lot's own page: everything the City publishes about its appeal.
    assert lawrence["appeals"] == [
        {
            "board": "zoning",
            "application": "Zoning Board of Adjustment",
            "type": "ZBA Permit Denial - Variance",
            "status": "Scheduled",
            "filed": "2026-08-03",
            "hearing": "2026-11-04",
            "hearing_time": "09:00",
            "rco": "Fixture Neighbors Association",
            "appellant": f"{rf.APPELLANT}; MORALES ROSA",
            "owner": "MORALES ROSA",
        }
    ]
    assert is_upcoming(lawrence["appeals"][0], "2026-10-04")
    assert lawrence["nearby"]["hearings_within_500ft"] == 1
    # A tenth of the lot in an overlay counts, a twentieth does not.
    names = lambda account: {  # noqa: E731
        common["overlays"][key]["name"]
        for key in parcel(built, account).get("rules", {}).get("overlays", [])
    }
    assert names("372000003") == {rf.NCO, rf.WISSAHICKON}
    assert rf.SLIVER not in names("372000004")
    near = parcel(built, "372000005")["rules"]["brownfields"]
    assert near[0]["id"] == "110000000000" and 0 < near[0]["m"] <= 100
    cluster = parcel(built, "375000001")["rules"]
    assert len(cluster["brownfields"]) == 3 and cluster["brownfields_more"] >= 2
    # Every source was there: nothing is partial for the rules.
    assert not set(lawrence.get("partial", [])) & {"historic", "overlays", "brownfields", "appeals"}


def test_who_filed_an_appeal_is_only_on_that_lots_own_page(built: Path) -> None:
    """docs/ETHICS.md, "Appeals and hearings": the appellant and the owner the City names appear
    in the lot's own dossier shard and in no other published file: not the map layers, not
    tables/, not the manifest, not dossiers/common.json and not the history shards. A person
    who filed an appeal about a parcel without a dossier appears nowhere."""
    files = files_under(built)
    holding = {name for name, text in files.items() if rf.APPELLANT in text}
    assert holding == {"dossiers/3710.json"}
    for name in files:
        if name.startswith(
            ("tiles/", "tables/", "manifest", "dossiers/common", "dossiers/history")
        ):
            assert rf.APPELLANT not in files[name] and "SAGE NEIGHBOR" not in files[name]
    assert not any("SAGE NEIGHBOR" in text for text in files.values())
    # And no appeal number (a zoning permit's number) anywhere.
    assert not any("ZP-2026-00000" in text for text in files.values())


def test_a_build_without_the_rules_sources_says_so_on_every_lot(context_factory, tmp_path) -> None:
    ctx = context_factory(now=NOW)
    install_everything(ctx)
    rf.install_rules(ctx, skip=("historic_sites", "epa_brownfields", "appeals"))
    out = tmp_path / "data"
    publish(ctx, out)
    lawrence = parcel(out, "371000001")
    assert {"historic", "brownfields", "appeals"} <= set(lawrence["partial"])
    assert "overlays" not in lawrence["partial"]
    assert "appeals" not in lawrence and "hearings_within_500ft" not in lawrence["nearby"]
    # The districts alone are not the historic part: without the Register it is left out.
    assert "historic" not in lawrence.get("rules", {})


def test_parcels_without_a_point_or_shape_get_no_rules() -> None:
    sets = lr.RuleSets(zoning=[box(-1, -1, 1, 1)], zoning_records=[{"code": "RSA-5"}])
    assert lr.lot_rules(["111111111"], {}, {}, sets) == {}
    assert lr.lot_rules(["111111111"], {}, {"111111111": (0.0, 0.0)}, sets) == {
        "111111111": {"zoning": {"code": "RSA-5"}}
    }
    assert shapely.is_valid(lr.valid(shapely.Polygon([(0, 0), (1, 1), (1, 0), (0, 1)])))
