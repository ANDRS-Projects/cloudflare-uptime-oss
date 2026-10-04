import type { CheckResult, Monitor, MonitorType } from './types';

// Monitor types that are never checked over the network: their status comes
// from heartbeats the monitored service sends in (push, push_down) or from a
// value an admin sets by hand (manual).
const PASSIVE_TYPES: ReadonlySet<MonitorType> = new Set(['push', 'push_down', 'manual']);

export function isPassiveType(type: MonitorType): boolean {
  return PASSIVE_TYPES.has(type);
}

export function isPushType(type: MonitorType): boolean {
  return type === 'push' || type === 'push_down';
}

// Minimum seconds between two recorded heartbeats for one monitor. The push
// endpoint is unauthenticated by design, so this caps how many D1 writes a
// caller that heartbeats in a tight loop can cause.
export const MIN_HEARTBEAT_GAP_SECONDS = 10;

// What one received heartbeat records. push: the service is alive, so up.
// push_down: the heartbeat is the event itself, so down until it ages out.
export function heartbeatResult(type: 'push' | 'push_down', latencyMs: number): CheckResult {
  return type === 'push_down'
    ? { ok: false, degraded: false, status_code: 0, latency_ms: latencyMs, error: 'Push event active', json_value: null }
    : { ok: true, degraded: false, status_code: 200, latency_ms: latencyMs, error: null, json_value: null };
}

// The check result cron records for a passive monitor on one of its due
// ticks, or null when there is nothing to record (a push monitor whose
// heartbeat is still fresh — the heartbeat itself already recorded an up
// check, and "no data yet" is the honest state before the first one).
//
// A late push heartbeat is degraded (ok + degraded) during the grace period,
// not down: degraded neither opens an incident nor fires an alert, matching
// how json_status_map degraded results behave. It only becomes down — and
// alerts — once interval + grace has passed with no heartbeat.
export function evaluatePassiveMonitor(m: Monitor, now: number): CheckResult | null {
  if (m.monitor_type === 'push') {
    const baseline = m.last_heartbeat_at ?? m.created_at;
    const age = now - baseline;
    const intervalSec = m.interval_minutes * 60;
    if (age < intervalSec) return null;
    if (age < intervalSec + m.grace_period_minutes * 60) {
      return { ok: true, degraded: true, status_code: 0, latency_ms: null, error: 'Heartbeat overdue (within grace period)', json_value: null };
    }
    const error = m.last_heartbeat_at == null ? 'No heartbeat received' : 'Heartbeat overdue';
    return { ok: false, degraded: false, status_code: 0, latency_ms: null, error, json_value: null };
  }

  if (m.monitor_type === 'push_down') {
    const active = m.last_heartbeat_at != null && now - m.last_heartbeat_at < m.interval_minutes * 60;
    return active
      ? { ok: false, degraded: false, status_code: 0, latency_ms: null, error: 'Push event active', json_value: null }
      : { ok: true, degraded: false, status_code: 200, latency_ms: null, error: null, json_value: null };
  }

  const status = m.manual_status ?? 'up';
  return {
    ok: status !== 'down',
    degraded: status === 'degraded',
    status_code: status === 'down' ? 0 : 200,
    latency_ms: null,
    error: status === 'down' ? 'Manual status: down' : null,
    json_value: null,
  };
}
