import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';

export async function listPages(c: Context<{ Bindings: Env }>) {
  const pages = await db.getStatusPages(c.env.DB);
  return c.json(pages);
}

export async function createPage(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{ name: string; slug: string; description?: string }>();

  if (!body.name || !body.slug) {
    return c.json({ error: 'name and slug are required' }, 400);
  }
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return c.json({ error: 'slug must be lowercase alphanumeric with hyphens only' }, 400);
  }

  const id = crypto.randomUUID();
  await db.createStatusPage(c.env.DB, {
    id,
    name: body.name,
    slug: body.slug,
    description: body.description ?? null,
    custom_domain: null,
    logo_url: null,
    incident_history_days: 30,
    min_incident_duration_minutes: 0,
    header_template: 'centered',
    brand_color: null,
  });
  return c.json({ id }, 201);
}

const HEADER_TEMPLATES = ['centered', 'banner', 'compact', 'navbar'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updatePage(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ['name', 'slug', 'description', 'custom_domain', 'logo_url', 'incident_history_days', 'min_incident_duration_minutes', 'header_template', 'brand_color'];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  if ('header_template' in updates && !HEADER_TEMPLATES.includes(updates.header_template as string)) {
    return c.json({ error: 'header_template must be one of ' + HEADER_TEMPLATES.join(', ') }, 400);
  }
  if ('brand_color' in updates && updates.brand_color !== null && !HEX_COLOR.test(updates.brand_color as string)) {
    return c.json({ error: 'brand_color must be a hex color like #7c3aed, or null to clear it' }, 400);
  }

  await db.updateStatusPage(c.env.DB, id, updates);
  return c.json({ ok: true });
}

export async function deletePage(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  await db.deleteStatusPage(c.env.DB, id);
  return c.json({ ok: true });
}

export async function getPageMonitors(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  const monitors = await db.getStatusPageMonitors(c.env.DB, id);
  return c.json(monitors);
}

export async function addMonitorToPage(c: Context<{ Bindings: Env }>) {
  const pageId = c.req.param('id');
  if (!pageId) return c.json({ error: 'missing id' }, 400);
  const body = await c.req.json<{ monitor_id: string; display_order?: number }>();

  if (!body.monitor_id) {
    return c.json({ error: 'monitor_id required' }, 400);
  }
  await db.addMonitorToPage(c.env.DB, pageId, body.monitor_id, body.display_order ?? 0);
  return c.json({ ok: true });
}

export async function removeMonitorFromPage(c: Context<{ Bindings: Env }>) {
  const { id: pageId, monitorId } = c.req.param();
  await db.removeMonitorFromPage(c.env.DB, pageId, monitorId);
  return c.json({ ok: true });
}
