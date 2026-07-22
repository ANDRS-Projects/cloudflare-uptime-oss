export interface Env {
  DB: D1Database;
  API_KEY: string;
  ASSETS?: R2Bucket;
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  interval_minutes: number;
  timeout_ms: number;
  alert_webhook: string | null;
  expected_status_code: number | null;
  retry_count: number;
  json_path: string | null;
  json_status_map: string | null;
  created_at: number;
  active: number;
}

export interface Check {
  id: number;
  monitor_id: string;
  status_code: number;
  ok: number;
  degraded: number;
  latency_ms: number | null;
  error: string | null;
  json_value: string | null;
  checked_at: number;
}

export interface Incident {
  id: number;
  monitor_id: string;
  started_at: number;
  resolved_at: number | null;
  trigger_status_code?: number | null;
  trigger_error?: string | null;
}

export interface StatusPage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  custom_domain: string | null;
  logo_url: string | null;
  incident_history_days: number;
  min_incident_duration_minutes: number;
  created_at: number;
}

export interface IncidentHistoryItem {
  id: number;
  monitor_id: string;
  monitor_name: string;
  started_at: number;
  resolved_at: number | null;
  trigger_status_code: number | null;
  trigger_error: string | null;
}

export interface Notice {
  id: string;
  status_page_id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: number;
  resolved_at: number | null;
}

export interface CheckResult {
  ok: boolean;
  degraded: boolean;
  status_code: number;
  latency_ms: number | null;
  error: string | null;
  json_value: string | null;
}
