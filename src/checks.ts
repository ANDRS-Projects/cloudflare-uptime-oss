import type { Monitor, CheckResult } from './types';
import { connect } from 'cloudflare:sockets';

const RETRY_DELAY_MS = 2000;

export async function checkWithRetry(monitor: Monitor): Promise<CheckResult> {
  let last!: CheckResult;
  for (let attempt = 0; attempt < monitor.retry_count; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    last = await runCheck(monitor);
    if (last.ok) return last;
  }
  return last;
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((cur, key) => {
    if (cur != null && typeof cur === 'object') return (cur as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export async function runCheck(monitor: Monitor): Promise<CheckResult> {
  const start = Date.now();

  if (monitor.url.startsWith('tcp://')) {
    try {
      const url = new URL(monitor.url);
      const hostname = url.hostname;
      const port = parseInt(url.port, 10);
      if (!hostname || isNaN(port)) {
        return { ok: false, degraded: false, status_code: 0, latency_ms: 0, error: 'Invalid TCP URL', json_value: null };
      }

      const socket = connect({ hostname, port });
      
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout')), monitor.timeout_ms);
      });

      try {
        await Promise.race([
          socket.opened,
          timeoutPromise
        ]);
        clearTimeout(timeoutId!);
        socket.close();
        return { ok: true, degraded: false, status_code: 0, latency_ms: Date.now() - start, error: null, json_value: null };
      } catch (err) {
        clearTimeout(timeoutId!);
        socket.close();
        throw err;
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'Timeout';
      return {
        ok: false,
        degraded: false,
        status_code: 0,
        latency_ms: isTimeout ? monitor.timeout_ms : Date.now() - start,
        error: isTimeout ? 'Request timed out' : err instanceof Error ? err.message : 'Unknown error',
        json_value: null,
      };
    }
  }

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

    const statusOk = monitor.expected_status_code != null
      ? response.status === monitor.expected_status_code
      : response.status >= 200 && response.status < 400;

    if (!statusOk) {
      return { ok: false, degraded: false, status_code: response.status, latency_ms: Date.now() - start, error: null, json_value: null };
    }

    if (monitor.json_path && monitor.json_status_map) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { ok: false, degraded: false, status_code: response.status, latency_ms: Date.now() - start, error: 'Failed to parse JSON response', json_value: null };
      }
      const value = String(resolvePath(body, monitor.json_path) ?? '');
      let map: Record<string, string>;
      try {
        map = JSON.parse(monitor.json_status_map);
      } catch {
        return { ok: false, degraded: false, status_code: response.status, latency_ms: Date.now() - start, error: 'Invalid json_status_map config', json_value: null };
      }
      const mapped = map[value] ?? 'down';
      return {
        ok: mapped === 'up' || mapped === 'degraded',
        degraded: mapped === 'degraded',
        status_code: response.status,
        latency_ms: Date.now() - start,
        error: mapped === 'down' ? `JSON status: ${value}` : null,
        json_value: value,
      };
    }

    return { ok: true, degraded: false, status_code: response.status, latency_ms: Date.now() - start, error: null, json_value: null };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      degraded: false,
      status_code: 0,
      latency_ms: isTimeout ? monitor.timeout_ms : Date.now() - start,
      error: isTimeout ? 'Request timed out' : err instanceof Error ? err.message : 'Unknown error',
      json_value: null,
    };
  }
}
