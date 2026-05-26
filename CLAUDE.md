# cloudflare-uptime

**Version:** 1.0.0 | **Runtime:** Cloudflare Workers | **Stack:** TypeScript + Hono + D1 + R2

## What

Self-hosted uptime monitoring on Cloudflare Workers. Cron checks run every minute (configurable),
store results in D1, and serve public status pages with 90-day latency history and an RSS feed.
No servers. No monthly fees beyond the Cloudflare free tier.

## Quick Start

```bash
npm install                                               # Install dependencies
wrangler d1 create uptime-monitor                        # Create D1 — paste ID into wrangler.toml
wrangler d1 execute uptime-monitor --file=schema.sql     # Apply schema (local)
wrangler r2 bucket create uptime-assets                  # Create R2 bucket
wrangler secret put API_KEY                              # Set admin auth secret
npm run deploy                                           # Deploy to Cloudflare
```

Or run the interactive bootstrap: `./setup.sh`

## Commands

```bash
# Development
npm install                                               # Install dependencies
npm run dev                                              # Local dev (wrangler dev)

# Schema
npm run db:init                                          # Apply schema.sql (local D1)
npm run db:init:remote                                   # Apply schema.sql (remote D1)

# Deploy
npm run deploy                                           # Deploy Worker to Cloudflare
```

## Architecture

```
src/
  worker.ts          # Hono app — all route registrations, custom domain middleware
  cron.ts            # ScheduledEvent handler — runs checks, fires alerts, daily cleanup
  checks.ts          # HTTP check runner (fetch + AbortController timeout)
  alerts.ts          # Slack/Discord webhook payload builder
  db.ts              # All D1 query functions (single source of truth for SQL)
  types.ts           # Shared TypeScript interfaces (Env, Monitor, Check, Incident…)
  api/
    monitors.ts      # CRUD for monitors
    pages.ts         # CRUD for status pages + monitor assignments
    notices.ts       # Maintenance notice lifecycle
    public.ts        # Unauthenticated status page data endpoint
    rss.ts           # RSS feed generator
    upload.ts        # R2 logo upload/delete
  html/
    admin.ts         # Admin dashboard (inline HTML/JS, no build step)
    status.ts        # Public status page shell (fetches /status/:slug/data at runtime)
schema.sql           # Full D1 schema — run once with wrangler d1 execute
wrangler.toml        # Worker config: D1 binding, R2 binding, cron schedule, routes
```

Admin dashboard at `/` (auth via `X-API-Key` header). Public status pages at `/status/:slug`.
Custom domain routing: the `*` middleware maps an incoming hostname to its status page slug via D1.

## Key Files

```
wrangler.toml        # Change database_id after `wrangler d1 create`, add custom routes here
schema.sql           # Run this once — NOT auto-applied on deploy
src/worker.ts        # Route table and custom domain middleware
src/cron.ts          # Check interval logic: minuteOfDay % interval_minutes === 0
src/db.ts            # Every D1 query — start here when debugging data issues
src/types.ts         # Env interface (DB: D1Database, ASSETS: R2Bucket, API_KEY: string)
src/checks.ts        # What "ok" means: HTTP 200–399; anything else (including timeout) is down
src/alerts.ts        # Webhook format: Slack/Discord compatible attachments payload
```

## Configuration

| Variable / Setting | Where set | Required | Description |
|--------------------|-----------|----------|-------------|
| `API_KEY` | `wrangler secret put API_KEY` | Yes | Admin auth — all `/api/*` routes check `X-API-Key` header |
| `database_id` | `wrangler.toml` | Yes | D1 database ID from `wrangler d1 create uptime-monitor` |
| `bucket_name` | `wrangler.toml` | Yes | R2 bucket for logos (default: `uptime-assets`) |
| `crons` | `wrangler.toml` `[triggers]` | Yes | Check schedule (default: `* * * * *` = every minute) |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | CI only | Workers:Edit + D1:Edit + R2:Edit permissions |
| `alert_webhook` | per-monitor field | No | Slack or Discord incoming webhook URL |
| `routes` | `wrangler.toml` | No | Custom domains for status pages (must be on Cloudflare DNS) |

## Gotchas for AI Assistants

- **Schema migrations are manual.** `wrangler deploy` does NOT run `schema.sql`. Use
  `wrangler d1 execute uptime-monitor --remote --file=schema.sql` for the initial apply.
  For ALTER TABLE changes, run raw SQL in the Cloudflare D1 Console.
- **No frontend build step.** All HTML is returned as template-literal strings from
  `src/html/admin.ts` and `src/html/status.ts`. Do not introduce a bundler.
- **`workers_dev = true`** in `wrangler.toml` exposes the Worker on a `.workers.dev` URL.
  Custom domains are added via `[[routes]]` blocks — each requires `custom_domain = true`
  and the domain must be proxied through Cloudflare DNS.
- **Cron runs from one datacenter**, not globally. D1 latency is lowest when the cron
  datacenter is geographically close to your D1 region.
- **`interval_minutes` is checked by modulo**, not by timestamp delta. If the cron fires
  every minute and a monitor has `interval_minutes = 5`, it runs when `minuteOfDay % 5 === 0`.
- **Checks table has a 90-day rolling window.** The cleanup in `cron.ts` deletes rows older
  than 90 days once per day (at midnight UTC).
- **`alert_webhook` is stored per-monitor** (not per status page). Set it to a Slack or
  Discord incoming webhook URL to receive up/down alerts.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
