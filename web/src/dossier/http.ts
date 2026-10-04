// One careful way to ask a City server for JSON from the browser: a time limit, no cookies, no
// referrer, and a plain reason when it fails, so the page can say what happened and fall back to
// the weekly snapshot. Browsers do not let a page set its own User-Agent, so these requests carry
// the visitor's browser name, like any visit to the City's own sites.

/** Why a live lookup did not work, in words the page can explain. */
export type FailReason = 'timeout' | 'network' | 'http' | 'bad_data' | 'not_found' | 'aborted';

export type FetchResult = { ok: true; data: unknown } | { ok: false; reason: FailReason; status?: number };

/** How long to wait for a City server before showing the snapshot instead. */
export const LIVE_TIMEOUT_MS = 10_000;

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Cancels the request, for example when the person opens another lot first. */
  signal?: AbortSignal;
}

export async function fetchJson(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const { fetchImpl = fetch, timeoutMs = LIVE_TIMEOUT_MS, signal } = options;
  if (signal?.aborted) return { ok: false, reason: 'aborted' };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        mode: 'cors',
        headers: { Accept: 'application/json' },
      });
    } catch {
      if (timedOut) return { ok: false, reason: 'timeout' };
      if (signal?.aborted) return { ok: false, reason: 'aborted' };
      return { ok: false, reason: 'network' };
    }
    if (response.status === 404) return { ok: false, reason: 'not_found', status: 404 };
    if (!response.ok) return { ok: false, reason: 'http', status: response.status };
    try {
      return { ok: true, data: await response.json() };
    } catch {
      if (timedOut) return { ok: false, reason: 'timeout' };
      if (signal?.aborted) return { ok: false, reason: 'aborted' };
      return { ok: false, reason: 'bad_data' };
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
