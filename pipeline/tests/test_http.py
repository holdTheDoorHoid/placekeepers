"""The polite HTTP client: User-Agent, retries with backoff, refusals, rate limit, atomic files."""

from __future__ import annotations

import hashlib
from pathlib import Path

import httpx
import pytest

from placekeepers.config import USER_AGENT
from placekeepers.httpclient import AccessRefused, HttpError, PoliteClient, RetryableError


def client(handler, **kwargs) -> tuple[PoliteClient, list[float]]:
    sleeps: list[float] = []
    options = {"sleep": sleeps.append, "min_interval": 0, "rng": lambda: 1.0, **kwargs}
    return PoliteClient(transport=httpx.MockTransport(handler), **options), sleeps


def test_every_request_says_who_we_are(tmp_path: Path) -> None:
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers["user-agent"])
        return httpx.Response(200, json={"ok": True})

    http, _ = client(handler)
    http.get_json("https://phl.carto.com/api/v2/sql", {"q": "SELECT 1"})
    http.download("https://phl.carto.com/api/v2/sql", tmp_path / "chunk.csv")
    expected = "Placekeepers/0.1 (+https://github.com/holdTheDoorHoid/placekeepers)"
    assert seen == [expected, expected]
    assert expected == USER_AGENT


def test_busy_servers_are_retried_with_growing_waits() -> None:
    replies = iter([503, 502, 200])

    def handler(request: httpx.Request) -> httpx.Response:
        status = next(replies)
        return httpx.Response(status, json={"n": 1} if status == 200 else None)

    http, sleeps = client(handler, backoff_base=2.0)
    assert http.get_json("https://example.org/api") == {"n": 1}
    assert http.requests_sent == 3
    assert sleeps == [2.0, 4.0]


def test_retry_after_is_honored() -> None:
    replies = iter([httpx.Response(429, headers={"Retry-After": "7"}), httpx.Response(200)])
    http, sleeps = client(lambda request: next(replies))
    http.get("https://example.org/api")
    assert sleeps == [7.0]


def test_network_errors_are_retried_then_reported() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    http, sleeps = client(handler, max_attempts=3)
    with pytest.raises(HttpError, match="gave up after 3 attempts: network problem"):
        http.get("https://example.org/api")
    assert http.requests_sent == 3
    assert len(sleeps) == 2


def test_a_refusal_is_never_retried() -> None:
    http, sleeps = client(lambda request: httpx.Response(403, text="Forbidden"))
    with pytest.raises(AccessRefused, match="never works around a refusal"):
        http.get("https://example.org/private")
    assert http.requests_sent == 1
    assert sleeps == []


def test_a_bad_request_fails_at_once_with_the_reply() -> None:
    http, _ = client(lambda request: httpx.Response(400, json={"error": ["no such column"]}))
    with pytest.raises(HttpError, match="HTTP 400 .*no such column"):
        http.get("https://phl.carto.com/api/v2/sql")
    assert http.requests_sent == 1


def test_error_messages_inside_normal_replies_can_be_retried() -> None:
    replies = iter([{"error": {"code": 400}}, {"count": 5}])

    def check(data: dict) -> None:
        if "error" in data:
            raise RetryableError("error page")

    http, _ = client(lambda request: httpx.Response(200, json=next(replies)))
    assert http.get_json("https://example.org/query", check=check) == {"count": 5}


def test_requests_to_one_host_are_spaced_out() -> None:
    now = [100.0]
    sleeps: list[float] = []

    def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        now[0] += seconds

    http = PoliteClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200)),
        min_interval=1.5,
        sleep=sleep,
        clock=lambda: now[0],
    )
    http.get("https://a.example.org/1")
    now[0] += 0.5
    http.get("https://a.example.org/2")
    http.get("https://b.example.org/1")
    assert sleeps == [1.0]


def test_downloads_land_whole_or_not_at_all(tmp_path: Path) -> None:
    body = b"id,name\n1,Ann\n" * 1000
    http, _ = client(lambda request: httpx.Response(200, content=body))
    target = tmp_path / "raw" / "data.csv"
    result = http.download("https://example.org/data.csv", target)
    assert target.read_bytes() == body
    assert result.bytes == len(body)
    assert result.sha256 == hashlib.sha256(body).hexdigest()

    failing, _ = client(lambda request: httpx.Response(500), max_attempts=2)
    with pytest.raises(HttpError):
        failing.download("https://example.org/other.csv", tmp_path / "raw" / "other.csv")
    assert sorted(path.name for path in (tmp_path / "raw").iterdir()) == ["data.csv"]


def test_a_download_check_can_reject_an_error_page(tmp_path: Path) -> None:
    replies = iter([b'{"error": "timeout"}', b"a,b\n1,2\n"])

    def check(path: Path) -> None:
        if path.read_bytes().startswith(b"{"):
            raise RetryableError("got an error page")

    http, _ = client(lambda request: httpx.Response(200, content=next(replies)))
    target = tmp_path / "data.csv"
    http.download("https://example.org/data.csv", target, check_file=check)
    assert target.read_bytes() == b"a,b\n1,2\n"
    assert [path.name for path in tmp_path.iterdir()] == ["data.csv"]
