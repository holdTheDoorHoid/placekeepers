"""Deeds, sales, sheriff sales, the last sale and fast resales, from invented transfer records."""

from __future__ import annotations

from datetime import date

from placekeepers.derive import transfers as tr

AS_OF = date(2026, 10, 4)


def deed(
    day: str,
    kind: str = "DEED",
    price: float | None = 50000,
    doc: int | None = None,
    grantors: tuple[str, ...] = ("MORALES ROSA",),
    grantees: tuple[str, ...] = ("KENSINGTON LOTS LLC",),
    properties: int = 1,
) -> tr.Transfer:
    return tr.Transfer(
        document_id=doc,
        date=date.fromisoformat(day),
        type=kind,
        price=price,
        grantors=grantors,
        grantees=grantees,
        properties=properties,
    )


def test_only_deeds_are_transfers_newest_first_each_document_once() -> None:
    rows = [
        deed("2004-05-17", doc=1),
        deed("2004-05-17", doc=1),  # the same document twice
        deed("2010-01-04", "MORTGAGE", doc=2),
        deed("2012-03-01", "SATISFACTION OF MORTGAGE", doc=3),
        deed("2016-08-09", "SHERIFF'S DEED", 12300, doc=4),
        deed("2018-02-02", "MISCELLANEOUS DEED", 1, doc=5),
        deed("2019-06-30", "CERTIFICATE OF STOCK TRANSFER", 90000, doc=6),
        deed("2021-11-11", "DEED - ADVERSE POSSESSION", 0, doc=7),
    ]
    history = tr.deeds(rows)
    assert [t.document_id for t in history] == [7, 6, 5, 4, 1]
    assert [t.sheriff for t in history] == [False, False, False, True, False]


def test_names_are_split_and_long_lists_are_counted() -> None:
    assert tr.split_names("RIEHL EMILY;RIEHL WALTER EZRA; ") == ["RIEHL EMILY", "RIEHL WALTER EZRA"]
    many = tuple(f"DEFENDANT {i}" for i in range(14))
    out = deed("2015-12-17", "DEED SHERIFF", 1600, grantors=many, properties=3).to_json()
    assert out == {
        "date": "2015-12-17",
        "type": "DEED SHERIFF",
        "price": 1600,
        "from": list(many[:10]),
        "to": ["KENSINGTON LOTS LLC"],
        "from_more": 4,
        "properties": 3,
    }
    assert deed("1987-04-05", price=None).to_json()["price"] is None


def test_the_last_sale_leaves_out_token_and_sheriff_deeds() -> None:
    history = tr.deeds(
        [
            deed("2004-05-17", price=48000, doc=1),
            deed("2016-08-09", "SHERIFF'S DEED", 12300, doc=2),
            deed("2019-02-01", "DEED", 1, doc=3),  # a one dollar transfer
            deed("2020-07-07", "DEED OF CONDEMNATION", 15000, doc=4),
        ]
    )
    found = tr.last_sale(history, date(2019, 2, 1), 1, AS_OF)
    assert (found.known, found.year, found.price, found.source) == (True, 2004, 48000, "transfers")


def test_before_2000_the_assessors_last_sale_counts() -> None:
    found = tr.last_sale([], date(1987, 6, 12), 15000, AS_OF)
    assert (found.known, found.year, found.date, found.source) == (
        True,
        1987,
        date(1987, 6, 12),
        "opa",
    )


def test_a_token_transfer_before_2000_means_not_sold_since_then() -> None:
    found = tr.last_sale([], date(1985, 3, 1), 1, AS_OF)
    assert (found.known, found.year) == (False, 1985)


def test_with_no_sale_at_all_the_full_records_set_the_year() -> None:
    nominal = tr.deeds([deed("2011-05-05", "DEED", 1, doc=1)])
    found = tr.last_sale(nominal, date(2011, 5, 5), 1, AS_OF)
    assert (found.known, found.year) == (False, 2000)
    assert tr.last_sale([], None, None, AS_OF) == tr.LastSale(2000, False)


def test_the_assessors_sale_is_not_used_when_the_deed_records_hold_that_transfer() -> None:
    # OPA's sale on 2016-08-08 is the sheriff deed recorded the next day: not a sale.
    history = tr.deeds([deed("2016-08-09", "SHERIFF'S DEED", 12300, doc=2)])
    found = tr.last_sale(history, date(2016, 8, 8), 12300, AS_OF)
    assert (found.known, found.year) == (False, 2000)


def test_a_recent_sale_the_deed_records_do_not_have_yet_comes_from_the_assessor() -> None:
    history = tr.deeds([deed("2012-01-10", price=30000, doc=1)])
    found = tr.last_sale(history, date(2026, 9, 1), 85000, AS_OF)
    assert (found.year, found.price, found.source) == (2026, 85000, "opa")


def test_dates_after_the_build_and_impossible_dates_are_ignored() -> None:
    found = tr.last_sale([], date(206, 4, 22), 5000, AS_OF)
    assert (found.known, found.year) == (False, 2000)
    future = tr.deeds([deed("2027-01-01", price=90000, doc=1)])
    assert tr.last_sale(future, None, None, AS_OF).known is False


def test_sheriff_sales_oldest_first() -> None:
    history = tr.deeds(
        [
            deed("2026-05-20", "SHERIFF'S DEED", 6600, doc=3),
            deed("2006-09-21", "DEED SHERIFF", 4100, doc=1),
            deed("2015-12-17", "DEED SHERIFF", 1600, doc=2),
        ]
    )
    assert [t.date.year for t in tr.sheriff_sales(history)] == [2006, 2015, 2026]


def test_fast_resales_recent() -> None:
    history = tr.deeds(
        [
            deed("2023-02-01", price=20000, doc=1),
            deed("2024-03-15", "SHERIFF'S DEED", 31000, doc=2),
            deed("2025-11-30", price=95000, doc=3),
            deed("2025-11-30", price=95000, doc=4),  # recorded twice that day: one sale
        ]
    )
    found = tr.fast_resales(history, AS_OF)
    assert found is not None
    assert (found.count, found.first, found.last, found.recent) == (
        3,
        date(2023, 2, 1),
        date(2025, 11, 30),
        True,
    )


def test_fast_resales_long_ago() -> None:
    history = tr.deeds(
        [
            deed("2001-08-29", price=9000, doc=1),
            deed("2003-06-24", price=15000, doc=2),
            deed("2003-10-21", price=41000, doc=3),
            deed("2012-05-05", price=60000, doc=4),
        ]
    )
    found = tr.fast_resales(history, AS_OF)
    assert (found.count, found.first.year, found.last.year, found.recent) == (3, 2001, 2003, False)


def test_no_fast_resale_when_sales_are_more_than_24_months_apart_or_token() -> None:
    apart = tr.deeds(
        [deed("2018-01-01", price=20000, doc=1), deed("2020-01-02", price=30000, doc=2)]
    )
    assert tr.fast_resales(apart, AS_OF) is None
    exactly = tr.deeds(
        [deed("2018-01-01", price=20000, doc=1), deed("2020-01-01", price=30000, doc=2)]
    )
    assert tr.fast_resales(exactly, AS_OF).count == 2
    token = tr.deeds([deed("2025-01-01", price=1, doc=1), deed("2025-06-01", price=45000, doc=2)])
    assert tr.fast_resales(token, AS_OF) is None


def test_add_months_clamps_to_the_end_of_the_month() -> None:
    assert tr.add_months(date(2024, 2, 29), 24) == date(2026, 2, 28)
    assert tr.add_months(date(2026, 10, 4), -24) == date(2024, 10, 4)
