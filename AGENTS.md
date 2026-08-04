# cloudflare-uptime

**Version:** 1.6.4 | **Runtime:** Cloudflare Workers | **Stack:** TypeScript + Hono + D1 + R2

This file is the canonical set of instructions for AI coding agents working in this repo
(Claude Code, Cursor, Copilot, Codex, etc.). If your tool reads a vendor-specific file
instead (e.g. `CLAUDE.md`), that file just points back here — keep this one up to date,
not a duplicate.

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
npm run typecheck                                        # tsc --noEmit — run this before committing

# Schema
npm run db:init                                          # Apply schema.sql (local D1)
npm run db:init:remote                                   # Apply schema.sql (remote D1)

# Deploy
npm run deploy                                           # Deploy Worker to Cloudflare
```

There is no automated test suite. `npm run typecheck` plus manual verification (see the
escaping gotcha below for why typecheck alone isn't always enough) is the check to run
before committing.

## Architecture

```
src/
  worker.ts          # Hono app — all route registrations, custom domain middleware, scheduled() dispatch
  cron.ts            # ScheduledEvent handler (the * * * * * trigger) — runs checks, fires alerts, daily cleanup
  health.ts          # ScheduledEvent handler (the */15 * * * * trigger) — self-monitoring staleness check
  checks.ts          # HTTP check runner (fetch + AbortController timeout)
  alerts.ts          # Slack/Discord webhook payload builders (per-monitor and self-monitoring)
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
    admin.ts         # Admin dashboard (inline HTML/JS, no build step — see gotcha below)
    status.ts        # Public status page shell (fetches /status/:slug/data at runtime)
schema.sql           # Full D1 schema — run once with wrangler d1 execute
wrangler.toml        # Worker config: D1 binding, R2 binding, cron schedules, routes
```

Admin dashboard at `/` (auth via `X-API-Key` header). Public status pages at `/status/:slug`.
Custom domain routing: the `*` middleware maps an incoming hostname to its status page slug via D1.

## Key Files

```
wrangler.toml        # Change database_id after `wrangler d1 create`, add custom routes here
schema.sql           # Run this once — NOT auto-applied on deploy
src/worker.ts        # Route table, custom domain middleware, and scheduled() dispatch by event.cron
src/cron.ts          # Check interval + stagger-offset logic (see gotcha below)
src/health.ts        # Self-monitoring staleness check — runs on its own cron, never touches the hot path
src/db.ts            # Every D1 query — start here when debugging data issues
src/types.ts         # Env interface (DB: D1Database, ASSETS: R2Bucket, API_KEY, HEALTH_ALERT_WEBHOOK)
src/checks.ts        # What "ok" means: HTTP 200–399; anything else (including timeout) is down
src/alerts.ts        # Webhook format: Slack/Discord compatible attachments payload
```

## Configuration

| Variable / Setting | Where set | Required | Description |
|--------------------|-----------|----------|-------------|
| `API_KEY` | `wrangler secret put API_KEY` | Yes | Admin auth — all `/api/*` routes check `X-API-Key` header |
| `database_id` | `wrangler.toml` | Yes | D1 database ID from `wrangler d1 create uptime-monitor` |
| `bucket_name` | `wrangler.toml` | Yes | R2 bucket for logos (default: `uptime-assets`) |
| `crons` | `wrangler.toml` `[triggers]` | Yes | `* * * * *` runs the check loop; `*/15 * * * *` runs the self-monitoring health check — both required, see gotcha below |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | CI only | Workers:Edit + D1:Edit + R2:Edit permissions |
| `alert_webhook` | per-monitor field | No | Slack or Discord incoming webhook URL — per-monitor up/down alerts |
| `HEALTH_ALERT_WEBHOOK` | `wrangler secret put HEALTH_ALERT_WEBHOOK` | No | Slack/Discord webhook for self-monitoring alerts (fires when checks stop landing on schedule) |
| `routes` | `wrangler.toml` | No | Custom domains for status pages (must be on Cloudflare DNS) |

## Gotchas for AI Assistants

- **Schema migrations are manual.** `wrangler deploy` does NOT run `schema.sql`. Use
  `wrangler d1 execute uptime-monitor --remote --file=schema.sql` for the initial apply.
  Subsequent changes go in a numbered `migrations/NNN_*.sql` file, applied with
  `wrangler d1 migrations apply uptime-monitor --remote`. Always apply the migration
  *before* deploying code that depends on it — if a migration adds a table that cron
  writes to on every check, deploying first means cron errors on that write until the
  migration catches up. `deploy.yml` here does not apply migrations automatically.
- **`src/html/admin.ts` nests a full `<script>` block inside a returned template-literal
  string — escape sequences behave differently than they look.** `admin.ts` returns one
  big JS string containing literal HTML, which itself contains a `<script>` block of
  literal JS text. Any `\'` or similar escape you write in that inline JS gets resolved
  by the *outer* TypeScript template literal before it ever becomes a string — the
  backslash is silently consumed, and what actually reaches the browser is unescaped.
  This broke admin login in production once (an apostrophe in banner text closed a JS
  string early, breaking the whole inline `<script>` parse) and `tsc --noEmit` did not
  catch it, because the broken JS lives inside a string literal that TypeScript never
  parses as code. If you touch the inline JS in `admin.ts` (or `status.ts`) and it needs
  an apostrophe or backslash, either avoid it (reword) or verify by actually rendering
  the function's output and syntax-checking the real `<script>` content — e.g.
  `npx tsx` to call `renderAdmin(true)`, extract the `<script>...</script>` block from
  the output, and run `node --check` on it. Don't rely on `tsc --noEmit` alone for this
  file.
- **No frontend build step.** All HTML is returned as template-literal strings from
  `src/html/admin.ts` and `src/html/status.ts`. Do not introduce a bundler.
- **`workers_dev = true`** in `wrangler.toml` exposes the Worker on a `.workers.dev` URL.
  Custom domains are added via `[[routes]]` blocks — each requires `custom_domain = true`
  and the domain must be proxied through Cloudflare DNS.
- **Cron runs from one datacenter**, not globally. D1 latency is lowest when the cron
  datacenter is geographically close to your D1 region.
- **`interval_minutes` is checked by modulo plus a per-monitor stagger offset, not a
  plain modulo.** `cron.ts` computes a deterministic hash-based offset from `monitor.id`
  and checks `(minuteOfDay + checkOffset(...)) % interval_minutes === 0`. Each monitor
  still runs exactly once per `interval_minutes`, just at a different phase — this
  exists so monitors sharing a common-multiple interval (1/5/10/30 all divide 30) don't
  all land in the same cron tick at once. Don't "simplify" this back to plain modulo.
- **The Workers Free plan hard-caps CPU time at 10ms per invocation.** This is a real
  constraint, not a soft limit — a cron tick checking many monitors can genuinely run out
  of budget. `cron.ts` batches all due monitors' D1 writes/reads into a couple of
  round-trips per tick (not one per monitor) specifically to stay under this. If you add
  a new per-monitor D1 call inside the cron loop, batch it across all due monitors rather
  than calling it once per monitor in a loop — the fixed dispatch overhead per D1 call is
  what blows the budget, not D1's own query time.
- **`src/health.ts` runs on a separate, independent cron trigger (`*/15 * * * *`) and
  must never be merged into or add cost to the `* * * * *` check-loop tick** — it exists
  specifically to detect when that tick stops completing, so it can't depend on it.
- **Checks table has a 90-day rolling window.** The cleanup in `cron.ts` deletes rows older
  than 90 days once per day (at midnight UTC); `uptime_bucket_rollups` is cleaned the same way.
- **`alert_webhook` is stored per-monitor** (not per status page). Set it to a Slack or
  Discord incoming webhook URL to receive up/down alerts. `HEALTH_ALERT_WEBHOOK` is a
  separate, account-level secret for self-monitoring alerts — don't conflate the two.
- **Regenerating `package-lock.json` from scratch (`rm -f package-lock.json && npm install`)
  can silently produce an incomplete lockfile** missing optional platform-variant entries
  (`@esbuild/*`, `@img/sharp-*`, `@cloudflare/workerd-*` for platforms other than the one
  that generated it). `npm ci` requires full cross-platform consistency and will fail on
  a genuinely clean checkout (i.e. in CI) even though `npm ci` succeeds locally against
  that same file — it's self-consistent with itself, which isn't the same thing. When
  bumping a dependency, prefer editing `package.json` and running a plain `npm install`
  on top of the existing lockfile (incremental update) over deleting it first.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
