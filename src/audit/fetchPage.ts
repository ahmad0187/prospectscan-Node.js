export const USER_AGENT = 'ProspectScanBot/1.0 (+https://github.com/ahmad0187/prospectscan-Node.js)';

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  bytes: number;
  loadMs: number;
  contentType: string;
}

export class FetchError extends Error {
  constructor(message: string, readonly url: string) {
    super(message);
  }
}

const MAX_BYTES = 3 * 1024 * 1024;

/** GETs a page with a timeout, following redirects, and measures how long the full download took. */
export async function fetchPage(url: string, timeoutMs = 15000): Promise<FetchedPage> {
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    });
  } catch (err) {
    const msg = err instanceof Error && err.name === 'TimeoutError' ? `Timed out after ${timeoutMs / 1000}s` : 'Could not connect';
    throw new FetchError(msg, url);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const loadMs = Math.round(performance.now() - started);
  return {
    url,
    finalUrl: res.url || url,
    status: res.status,
    html: buf.subarray(0, MAX_BYTES).toString('utf8'),
    bytes: buf.length,
    loadMs,
    contentType: res.headers.get('content-type') ?? '',
  };
}

/** Lightweight status check used for broken-link sampling (HEAD, falling back to GET). */
export async function linkStatus(url: string, timeoutMs = 8000): Promise<number> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': USER_AGENT } });
      await res.body?.cancel();
      if (method === 'HEAD' && (res.status === 405 || res.status === 501)) continue;
      return res.status;
    } catch {
      if (method === 'GET') return 0;
    }
  }
  return 0;
}
