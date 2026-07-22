import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';

function rfc2822(unixTs: number): string {
  return new Date(unixTs * 1000).toUTCString();
}

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function durStr(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export async function getStatusPageRSS(c: Context<{ Bindings: Env }>) {
  const slug = c.req.param('slug')!;
  const page = await db.getStatusPage(c.env.DB, slug);
  if (!page) return c.notFound();

  const origin = new URL(c.req.url).origin;
  const pageUrl = `${origin}/status/${slug}`;

  const [monitors, notices] = await Promise.all([
    db.getStatusPageMonitors(c.env.DB, page.id),
    db.getAllNotices(c.env.DB, page.id),
  ]);

  const incidentRows = await Promise.all(
    monitors.map(async (m) => {
      const incidents = await db.getIncidents(c.env.DB, m.id, 20, page.min_incident_duration_minutes ?? 0);
      return incidents.map((i) => ({
        ts: i.started_at,
        title: i.resolved_at
          ? `Resolved: ${m.name} outage (lasted ${durStr(i.resolved_at - i.started_at)})`
          : `Ongoing outage: ${m.name}`,
        desc: i.resolved_at
          ? `The outage for ${m.name} started ${rfc2822(i.started_at)} and lasted ${durStr(i.resolved_at - i.started_at)}.`
          : `${m.name} has been down since ${rfc2822(i.started_at)}.`,
        guid: `incident-${i.id}`,
      }));
    })
  );

  const noticeItems = notices.map((n) => ({
    ts: n.created_at,
    title: `[${n.severity.toUpperCase()}] ${n.message.length > 80 ? n.message.substring(0, 80) + '…' : n.message}`,
    desc: n.resolved_at
      ? `${xmlEsc(n.message)} (Resolved ${rfc2822(n.resolved_at)})`
      : xmlEsc(n.message),
    guid: `notice-${n.id}`,
  }));

  const allItems = [...incidentRows.flat(), ...noticeItems]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 30);

  const items = allItems
    .map(
      (item) =>
        `    <item>
      <title>${xmlEsc(item.title)}</title>
      <description>${item.desc}</description>
      <pubDate>${rfc2822(item.ts)}</pubDate>
      <guid isPermaLink="false">${xmlEsc(item.guid)}</guid>
      <link>${pageUrl}</link>
    </item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEsc(page.name)} Status</title>
    <link>${pageUrl}</link>
    <description>${xmlEsc(page.description ?? `Status feed for ${page.name}`)}</description>
    <lastBuildDate>${rfc2822(Math.floor(Date.now() / 1000))}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return c.body(xml, 200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
}
