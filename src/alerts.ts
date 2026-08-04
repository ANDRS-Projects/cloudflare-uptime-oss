import type { Env, Monitor } from './types';

export async function sendAlert(monitor: Monitor, resolved: boolean): Promise<void> {
  if (!monitor.alert_webhook) return;

  const emoji = resolved ? '✅' : '🔴';
  const verb = resolved ? 'recovered' : 'is down';

  // Slack/Discord-compatible webhook payload
  const payload = {
    text: `${emoji} *${monitor.name}* ${verb}`,
    attachments: [
      {
        color: resolved ? '#22c55e' : '#ef4444',
        fields: [
          { title: 'URL', value: monitor.url, short: true },
          { title: 'Time', value: new Date().toUTCString(), short: true },
        ],
      },
    ],
  };

  try {
    await fetch(monitor.alert_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget — alerting failures must never break the check loop
  }
}

// Self-monitoring alert: this is about the Worker's own check loop, not any
// one monitor, so it goes to a separate account-level webhook (HEALTH_ALERT_WEBHOOK)
// rather than a per-monitor alert_webhook. Fires only on state transitions —
// see health.ts — so this never spams once-per-tick while a problem persists.
export async function sendHealthAlert(
  env: Env,
  unhealthy: boolean,
  staleMonitorNames: string[]
): Promise<void> {
  if (!env.HEALTH_ALERT_WEBHOOK) return;

  const payload = unhealthy
    ? {
        text: `⚠️ cloudflare-uptime: ${staleMonitorNames.length} monitor(s) haven't reported in longer than expected — checks may not be completing`,
        attachments: [
          {
            color: '#f59e0b',
            fields: [
              { title: 'Affected monitors', value: staleMonitorNames.join(', '), short: false },
              { title: 'Time', value: new Date().toUTCString(), short: true },
              {
                title: 'If this keeps recurring',
                value:
                  "The Workers Free plan's 10ms CPU limit is a common cause — upgrading to Workers Paid ($5/mo) raises it substantially for cron.",
                short: false,
              },
            ],
          },
        ],
      }
    : {
        text: `✅ cloudflare-uptime: monitor checks are reporting normally again`,
        attachments: [
          {
            color: '#22c55e',
            fields: [{ title: 'Time', value: new Date().toUTCString(), short: true }],
          },
        ],
      };

  try {
    await fetch(env.HEALTH_ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget — alerting failures must never break the health check
  }
}
