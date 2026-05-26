import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import * as db from './db';
import * as monitorsApi from './api/monitors';
import * as pagesApi from './api/pages';
import * as noticesApi from './api/notices';
import { uploadLogo, deleteLogo } from './api/upload';
import { getPublicStatusPage } from './api/public';
import { getStatusPageRSS } from './api/rss';
import { runCronJob } from './cron';
import { renderAdmin } from './html/admin';
import { renderStatusPage } from './html/status';

const app = new Hono<{ Bindings: Env }>();

// ── Custom domain routing ────────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (!url.hostname.endsWith('.workers.dev') && url.pathname === '/') {
    const page = await db.getStatusPageByDomain(c.env.DB, url.hostname);
    if (page) return c.html(renderStatusPage(page.slug));
  }
  return next();
});

// ── Auth middleware (API routes only) ────────────────────────────────────────
app.use('/api/*', cors());
app.use('/api/*', async (c, next) => {
  const key = c.req.header('X-API-Key');
  if (!key || key !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// ── Monitor API ──────────────────────────────────────────────────────────────
app.get('/api/monitors', monitorsApi.listMonitors);
app.post('/api/monitors', monitorsApi.createMonitor);
app.put('/api/monitors/:id', monitorsApi.updateMonitor);
app.delete('/api/monitors/:id', monitorsApi.deleteMonitor);
app.get('/api/monitors/:id/checks', monitorsApi.getMonitorChecks);

// ── Status Page API ──────────────────────────────────────────────────────────
app.get('/api/pages', pagesApi.listPages);
app.post('/api/pages', pagesApi.createPage);
app.put('/api/pages/:id', pagesApi.updatePage);
app.delete('/api/pages/:id', pagesApi.deletePage);
app.get('/api/pages/:id/monitors', pagesApi.getPageMonitors);
app.post('/api/pages/:id/monitors', pagesApi.addMonitorToPage);
app.delete('/api/pages/:id/monitors/:monitorId', pagesApi.removeMonitorFromPage);

// ── Notices API ──────────────────────────────────────────────────────────────
app.get('/api/pages/:id/notices', noticesApi.listNotices);
app.post('/api/pages/:id/notices', noticesApi.createNotice);
app.put('/api/pages/:id/notices/:noticeId/resolve', noticesApi.resolveNotice);
app.delete('/api/pages/:id/notices/:noticeId', noticesApi.deleteNotice);

// ── Logo upload API ──────────────────────────────────────────────────────────
app.post('/api/pages/:id/logo', uploadLogo);
app.delete('/api/pages/:id/logo', deleteLogo);

// ── Public routes (no auth) ──────────────────────────────────────────────────
app.get('/assets/*', async (c) => {
  const key = c.req.path.replace('/assets/', '');
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});

app.get('/status/:slug/data', getPublicStatusPage);
app.get('/status/:slug/rss', getStatusPageRSS);
app.get('/status/:slug', (c) => c.html(renderStatusPage(c.req.param('slug'))));
app.get('/', (c) => c.html(renderAdmin()));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCronJob(env));
  },
};
