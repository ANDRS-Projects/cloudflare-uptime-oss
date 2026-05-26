import type { Monitor } from './types';

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
