import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';

export async function listNotices(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id')!;
  const notices = await db.getAllNotices(c.env.DB, id);
  return c.json(notices);
}

export async function createNotice(c: Context<{ Bindings: Env }>) {
  const pageId = c.req.param('id')!;
  const body = await c.req.json<{ message: string; severity?: string }>();
  if (!body.message) return c.json({ error: 'message required' }, 400);
  const severity = (['info', 'warning', 'critical'] as const).includes(body.severity as never)
    ? (body.severity as 'info' | 'warning' | 'critical')
    : 'info';
  const id = crypto.randomUUID();
  await db.createNotice(c.env.DB, { id, status_page_id: pageId, message: body.message, severity });
  return c.json({ id }, 201);
}

export async function resolveNotice(c: Context<{ Bindings: Env }>) {
  const noticeId = c.req.param('noticeId')!;
  await db.resolveNotice(c.env.DB, noticeId);
  return c.json({ ok: true });
}

export async function deleteNotice(c: Context<{ Bindings: Env }>) {
  const noticeId = c.req.param('noticeId')!;
  await db.deleteNotice(c.env.DB, noticeId);
  return c.json({ ok: true });
}
