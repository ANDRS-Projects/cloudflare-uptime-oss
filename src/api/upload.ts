import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function uploadLogo(c: Context<{ Bindings: Env }>) {
  if (!c.env.ASSETS) return c.json({ error: 'R2 storage is not configured' }, 400);
  const pageId = c.req.param('id')!;

  const formData = await c.req.formData();
  const file = formData.get('logo') as File | null;
  if (!file || typeof file === 'string') return c.json({ error: 'no file provided' }, 400);
  if (!ALLOWED_TYPES.includes(file.type)) return c.json({ error: 'unsupported file type' }, 400);
  if (file.size > 2 * 1024 * 1024) return c.json({ error: 'file too large (max 2MB)' }, 400);

  const page = await db.getStatusPage(c.env.DB, pageId);
  if (!page) return c.notFound();

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const key = `logos/${pageId}-${crypto.randomUUID()}.${ext}`;

  await c.env.ASSETS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  if (page.logo_url?.startsWith('/assets/')) {
    await c.env.ASSETS.delete(page.logo_url.replace('/assets/', ''));
  }

  const url = `/assets/${key}`;
  await db.updateStatusPage(c.env.DB, pageId, { logo_url: url });

  return c.json({ url });
}

export async function deleteLogo(c: Context<{ Bindings: Env }>) {
  if (!c.env.ASSETS) return c.json({ error: 'R2 storage is not configured' }, 400);
  const pageId = c.req.param('id')!;
  const page = await db.getStatusPage(c.env.DB, pageId);
  if (!page) return c.notFound();

  if (page.logo_url?.startsWith('/assets/')) {
    const key = page.logo_url.replace('/assets/', '');
    await c.env.ASSETS.delete(key);
  }

  await db.updateStatusPage(c.env.DB, pageId, { logo_url: null });
  return c.json({ ok: true });
}
