import type { Monitor, CheckResult } from './types';

export async function runCheck(monitor: Monitor): Promise<CheckResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), monitor.timeout_ms);

    const response = await fetch(monitor.url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'CloudflareUptimeMonitor/1.0' },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    return {
      ok: response.status >= 200 && response.status < 400,
      status_code: response.status,
      latency_ms: Date.now() - start,
      error: null,
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      status_code: 0,
      latency_ms: isTimeout ? monitor.timeout_ms : Date.now() - start,
      error: isTimeout ? 'Request timed out' : err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
