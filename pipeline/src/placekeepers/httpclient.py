"""A polite HTTP client for public data servers.

Every request carries the Placekeepers User-Agent. Requests to one host are spaced out by a small
minimum interval. Network failures, timeouts and busy server replies (HTTP 408, 429 and 5xx) are
retried with exponential backoff and jitter, honoring Retry-After. A refusal (HTTP 401 or 403) is
never retried and never worked around. Downloads stream to a temporary file in the destination
folder and are renamed into place only when complete, so a reader never sees half a file.
"""

from __future__ import annotations

import hashlib
import logging
import os
import random
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from placekeepers.config import USER_AGENT

log = logging.getLogger(__name__)

RETRY_STATUSES = frozenset({408, 425, 429, 500, 502, 503, 504})


class HttpError(RuntimeError):
    """A request failed for good."""


class AccessRefused(HttpError):
    """The server refused access. Placekeepers never tries to get around this."""


class RetryableError(Exception):
    """A failure worth another try (network trouble, a busy server, an error page)."""

    def __init__(self, message: str, response: httpx.Response | None = None):
        super().__init__(message)
        self.response = response


@dataclass(frozen=True)
class DownloadResult:
    path: Path
    bytes: int
    sha256: str


def _short(url: str | httpx.URL) -> str:
    parsed = httpx.URL(str(url))
    return f"{parsed.host}{parsed.path}"


class PoliteClient:
    def __init__(
        self,
        *,
        user_agent: str = USER_AGENT,
        transport: httpx.BaseTransport | None = None,
        max_attempts: int = 5,
        backoff_base: float = 2.0,
        backoff_max: float = 60.0,
        min_interval: float = 1.0,
        timeout: httpx.Timeout | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        rng: Callable[[], float] = random.random,
    ):
        self.http = httpx.Client(
            headers={"User-Agent": user_agent},
            timeout=timeout or httpx.Timeout(30.0, read=300.0),
            transport=transport,
            follow_redirects=True,
        )
        self.max_attempts = max_attempts
        self.backoff_base = backoff_base
        self.backoff_max = backoff_max
        self.min_interval = min_interval
        self.sleep = sleep
        self.clock = clock
        self.rng = rng
        self.requests_sent = 0
        self._last_request: dict[str, float] = {}

    # -- context manager -----------------------------------------------------------------------

    def close(self) -> None:
        self.http.close()

    def __enter__(self) -> PoliteClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- politeness ----------------------------------------------------------------------------

    def _wait_turn(self, url: str) -> None:
        host = httpx.URL(url).host
        last = self._last_request.get(host)
        if last is not None:
            wait = self.min_interval - (self.clock() - last)
            if wait > 0:
                self.sleep(wait)
        self._last_request[host] = self.clock()

    def _backoff(self, attempt: int, response: httpx.Response | None) -> float:
        if response is not None:
            retry_after = response.headers.get("Retry-After", "")
            if retry_after.isdigit():
                return min(float(retry_after), 300.0)
        base = min(self.backoff_max, self.backoff_base * 2 ** (attempt - 1))
        return base * (0.5 + self.rng() / 2)

    def _check_status(self, response: httpx.Response) -> None:
        status = response.status_code
        if status < 400:
            return
        url = _short(response.request.url)
        if status in (401, 403):
            raise AccessRefused(
                f"{url} refused access (HTTP {status}). Placekeepers never works around a refusal; "
                "check the source's terms or ask its publisher."
            )
        if status in RETRY_STATUSES:
            raise RetryableError(f"HTTP {status} from {url}", response)
        body = response.text[:300].replace("\n", " ")
        raise HttpError(f"HTTP {status} from {url}: {body}")

    def _with_retries(self, url: str, call: Callable[[], Any]) -> Any:
        last: RetryableError | None = None
        for attempt in range(1, self.max_attempts + 1):
            self._wait_turn(url)
            try:
                return call()
            except RetryableError as exc:
                last = exc
                if attempt == self.max_attempts:
                    break
                delay = self._backoff(attempt, exc.response)
                log.warning(
                    "%s: %s; trying again in %.0f s (attempt %d of %d)",
                    _short(url),
                    exc,
                    delay,
                    attempt + 1,
                    self.max_attempts,
                )
                self.sleep(delay)
        raise HttpError(f"{_short(url)}: gave up after {self.max_attempts} attempts: {last}")

    # -- requests ------------------------------------------------------------------------------

    def _send(self, url: str, params: dict[str, Any] | None) -> httpx.Response:
        try:
            response = self.http.get(url, params=params)
        except httpx.TransportError as exc:
            raise RetryableError(f"network problem ({type(exc).__name__}: {exc})") from exc
        finally:
            self.requests_sent += 1
        self._check_status(response)
        return response

    def get(self, url: str, params: dict[str, Any] | None = None) -> httpx.Response:
        return self._with_retries(url, lambda: self._send(url, params))

    def get_json(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        *,
        check: Callable[[Any], None] | None = None,
    ) -> Any:
        """GET and decode JSON. `check` may raise RetryableError for error pages sent with 200."""

        def call() -> Any:
            response = self._send(url, params)
            try:
                data = response.json()
            except ValueError as exc:
                raise RetryableError(f"{_short(url)} did not send valid JSON") from exc
            if check is not None:
                check(data)
            return data

        return self._with_retries(url, call)

    def download(
        self,
        url: str,
        dest: Path,
        params: dict[str, Any] | None = None,
        *,
        check_file: Callable[[Path], None] | None = None,
    ) -> DownloadResult:
        """Stream a response body to `dest`, atomically. `check_file` may inspect the finished
        temporary file and raise RetryableError (for example, when it holds an error message)."""

        def call() -> DownloadResult:
            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp = dest.with_name(f".{dest.name}.{uuid.uuid4().hex[:8]}.part")
            try:
                try:
                    with self.http.stream("GET", url, params=params) as response:
                        if response.status_code >= 400:
                            response.read()
                            self._check_status(response)
                        digest = hashlib.sha256()
                        size = 0
                        with tmp.open("wb") as handle:
                            for chunk in response.iter_bytes(1 << 20):
                                handle.write(chunk)
                                digest.update(chunk)
                                size += len(chunk)
                            handle.flush()
                            os.fsync(handle.fileno())
                except httpx.TransportError as exc:
                    raise RetryableError(f"network problem ({type(exc).__name__}: {exc})") from exc
                finally:
                    self.requests_sent += 1
                if check_file is not None:
                    check_file(tmp)
                os.replace(tmp, dest)
                return DownloadResult(dest, size, digest.hexdigest())
            finally:
                tmp.unlink(missing_ok=True)

        return self._with_retries(url, call)
