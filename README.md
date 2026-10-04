# cloudflare-uptime

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Deploy](https://github.com/ANDRS-Projects/cloudflare-uptime/actions/workflows/deploy.yml/badge.svg)](https://github.com/ANDRS-Projects/cloudflare-uptime/actions/workflows/deploy.yml)
[![AGENTS.md](https://img.shields.io/badge/AGENTS.md-✓-6f42c1)](AGENTS.md)

Self-hosted uptime monitoring on Cloudflare Workers with public status pages — no servers, no monthly fees.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Deployment Guide](#deployment-guide)
- [Configuration Reference](#configuration-reference)
- [Development](#development)
- [Caveats](#caveats)
- [Using with Claude Code](#using-with-claude-code)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Multi-monitor support** — track any HTTP endpoint or TCP socket (via `tcp://`) with configurable check intervals and timeouts
- **Keyword monitors** — an HTTP check that also requires a given piece of text to appear in the page; goes down when the page loads but the text is missing
- **Push (heartbeat) monitors** — for cron jobs, backups and anything else you can't poll: your job calls a secret URL when it runs, and the monitor goes down if the call doesn't arrive in time. An *upside-down* variant goes down when its URL is called. **Manual monitors** let you set a status by hand. See [Push, keyword and manual monitors](#push-keyword-and-manual-monitors)
- **Public status pages** — shareable `/status/:slug` pages with live up/down status per monitor
- **90-day latency history** — sparkline graph built from the rolling check history; can be hidden per status page from the admin dashboard if you'd rather not publish response-time data
- **Incident timeline** — timestamped incidents with human-readable failure reasons (HTTP status badge + description, timeout label, or raw error)
- **Incident history page** — `/status/:slug/history` lists all incidents grouped by month with collapsible sections; history window (30 or 90 days) is configurable per status page from the admin dashboard
- **Minor incident filtering** — hide resolved incidents shorter than a configurable duration (5/15/30/60 min) from public status pages, the history page, and the RSS feed, so transient blips don't clutter real outages; ongoing incidents are always shown
- **RSS feed** — `/status/:slug/rss` for incident subscribers
- **Custom logo per page** — (Optional) upload a logo to R2; served through the Worker with immutable cache headers
- **Branded header templates** — choose a Default (centered), Banner, Compact, or Navbar header layout per status page, and set a `brand_color` (validated hex) that flows through the header background/underline and site-wide accent links; unbranded pages render exactly as before. Banner and Navbar backgrounds span the full page width; Navbar also shows a live "next check" countdown and an RSS bell icon, with the overall status summary floating over its bottom edge
- **Editable status page description** — set or update the description shown under the page title at any time from the admin dashboard, not just at creation
- **Custom domain routing** — each status page can be served on its own domain via `wrangler.toml` routes
- **Expected status code** — configure the expected HTTP response code per monitor (useful for endpoints that intentionally return 201, 204, 301, or any non-200 status)
- **JSON payload monitoring** — extract a field from the JSON response body and map its value to `up`, `degraded`, or `down`; built-in Statuspage.io preset covers Anthropic, GitHub, and any other Statuspage.io-powered status page out of the box
- **Degraded state** — yellow third state between green and red; degraded monitors appear on the status page without opening incidents or firing alerts
- **Admin dashboard** — add/edit/delete monitors and status pages, view check history with extracted JSON values per check; "Load more" pages back through a monitor's full 90-day retention window
- **Dark mode** — full light / dark / system theme support across the admin dashboard, status pages, and history pages; toggle persists via `localStorage`
- **Slack and Discord webhook alerts** — per-monitor webhooks fire on incident open and close
- **Maintenance notices** — create notices that appear on status pages; resolved notices stay visible for 24 hours with a "Resolved" badge
- **Cron-based checks** — Cloudflare cron triggers run the check loop on your configured schedule; per-monitor check timing is staggered by a deterministic offset so monitors sharing a common-multiple interval (e.g. 1/5/10/30 minutes) don't all land in the same tick
- **Self-monitoring health check** — a separate, low-frequency cron watches for monitors that have stopped reporting on schedule (a sign the check loop itself isn't completing) and shows a dashboard banner; optionally fires a Slack/Discord webhook on state changes (`HEALTH_ALERT_WEBHOOK`)
- **R2 asset storage** — logo uploads stored in and served from Cloudflare R2
- **CI/CD via GitHub Actions** — add `CLOUDFLARE_API_TOKEN` as a repo secret and trigger deploys manually (or change the workflow trigger to auto-deploy on push)
- **Security scanning** — Trivy (dependency CVEs) and Gitleaks (secret detection) run on every push

---

## Screenshots

<img width="1200" height="675" alt="drop-kit-landscape-1779790200368" src="https://github.com/user-attachments/assets/24cefe6b-8945-431b-bdac-140e35fd4a18" />
<img width="1200" height="675" alt="drop-kit-landscape-1779791596122" src="https://github.com/user-attachments/assets/5939865b-11f8-420e-8413-f6eeddec0729" />
<img width="1600" height="900" alt="drop-kit-youtube-banner-1785333964449" src="https://github.com/user-attachments/assets/7ce6cae7-31ac-49e2-a949-0202b7fbb228" />
<img width="1600" height="900" alt="drop-kit-youtube-banner-1785333944471" src="https://github.com/user-attachments/assets/3945fa11-47ae-47d9-bc44-e0cf61eb7982" />



---

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (Node 24 recommended — matches the CI workflow)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — installed via `npm install` (listed as a dev dependency)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- A Cloudflare API token with **Workers:Edit**, **D1:Edit**, and **R2:Edit** permissions

---

## Quick Start

```bash
git clone https://github.com/ANDRS-Projects/cloudflare-uptime.git
cd cloudflare-uptime
./setup.sh
```

`setup.sh` walks through every step interactively. For a manual walkthrough see the full [Deployment Guide](#deployment-guide) below.

---

## Deployment Guide

### 1. Install dependencies

```bash
npm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser window. Alternatively, set `CLOUDFLARE_API_TOKEN` in your shell environment.

### 3. Create the D1 database

```bash
npx wrangler d1 create uptime-monitor
```

The output includes a `database_id`. Copy it, then open `wrangler.toml` and paste it here:

```toml
[[d1_databases]]
binding = "DB"
database_name = "uptime-monitor"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"
```

### 4. Apply the database schema

```bash
# Local dev database:
npm run db:init

# Remote (production) database:
npm run db:init:remote
```

> **Important:** `wrangler deploy` does NOT apply `schema.sql` automatically. You must run this step manually on first deploy. For subsequent schema changes, run `ALTER TABLE` statements directly via the Cloudflare D1 Console.

### 5. Create the R2 bucket (Optional)

R2 storage is only required if you want to upload custom logos for your status pages. If you skip this, the logo upload feature will be automatically disabled in the admin dashboard.

```bash
npx wrangler r2 bucket create uptime-assets
```

If you choose a different bucket name, update `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "your-bucket-name"
```

### 6. Set the API key secret

```bash
npx wrangler secret put API_KEY
```

Enter a strong random string when prompted. Generate one with:

```bash
openssl rand -hex 32
```

This secret is the only authentication mechanism for the admin dashboard and all `/api/*` routes. Guard it carefully.

### 7. Deploy

```bash
npm run deploy
```

Your Worker is now live at `https://cloudflare-uptime.<your-subdomain>.workers.dev`.

### 8. (Optional) Custom domain routing

To serve a status page on `status.yourdomain.com`, add an entry to the `routes` array in `wrangler.toml`:

```toml
routes = [
  { pattern = "status.yourdomain.com", custom_domain = true },
]
```

You can add as many subdomains as you like — each status page can have its own domain. Then redeploy with `npm run deploy`.

**Do not create DNS records manually.** Wrangler creates and manages the DNS record for you automatically on deploy. If you pre-create a record, the deploy will fail with a `code: 100117` error — delete the manually created record in the Cloudflare dashboard first, then redeploy.

**Always commit `wrangler.toml` before deploying via CI.** If you add a domain and run `npm run deploy` locally without committing, the domain will work — but the next CI deploy will use the committed `wrangler.toml` (without your new route) and Wrangler will remove the DNS record, causing a 1016 Origin DNS error. Commit and push `wrangler.toml` changes alongside any local deploy.

The domain's zone must be on Cloudflare DNS (i.e. your domain uses Cloudflare nameservers). If your domain uses external nameservers, point a CNAME at your `.workers.dev` URL instead and omit `custom_domain = true`.

### 9. (Optional) Set up CI/CD

Add your Cloudflare API token as a GitHub Actions secret named `CLOUDFLARE_API_TOKEN`.

The included `.github/workflows/deploy.yml` is set to **manual trigger** by default (`workflow_dispatch`) so it won't fail on forks before secrets are configured. To enable auto-deploy on every push to `main`, change the `on:` trigger in the workflow file to:

```yaml
on:
  push:
    branches: [main]
```

Then trigger a deploy from the **Actions** tab → **Deploy** → **Run workflow**.

---

## Configuration Reference

All configuration lives in `wrangler.toml` (infrastructure) or as Wrangler secrets (runtime).
There is no traditional `.env` file — see `.env.example` for a full annotated reference.

### `wrangler.toml` fields

| Field | Default | Description |
|-------|---------|-------------|
| `name` | `cloudflare-uptime` | Worker name as shown in the Cloudflare dashboard |
| `main` | `src/worker.ts` | Entry point — do not change |
| `compatibility_date` | `2024-12-01` | Workers runtime version pin |
| `workers_dev` | `true` | Enables the `.workers.dev` subdomain |
| `d1_databases[].database_id` | `YOUR_D1_DATABASE_ID` | Paste output from `wrangler d1 create` |
| `d1_databases[].binding` | `DB` | Binding name — referenced as `Env.DB` in `src/types.ts` |
| `r2_buckets[].bucket_name` | `uptime-assets` | R2 bucket for logo uploads |
| `r2_buckets[].binding` | `ASSETS` | Binding name — referenced as `Env.ASSETS` in `src/types.ts` |
| `triggers.crons` | `["* * * * *"]` | Cron schedule for check runs (every minute by default) |
| `routes[].pattern` | — | Custom domain (e.g. `status.yourdomain.com`) |
| `routes[].custom_domain` | `true` | Required for Cloudflare-proxied domains |

### Wrangler secrets (runtime)

| Secret | Required | Description |
|--------|----------|-------------|
| `API_KEY` | Yes | Authenticates all `/api/*` requests via the `X-API-Key` header |
| `HEALTH_ALERT_WEBHOOK` | No | Slack/Discord webhook for self-monitoring alerts — fires when monitor checks stop landing on schedule (see `src/health.ts`) |

### GitHub Actions secrets (CI/CD)

| Secret | Required | Description |
|--------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | Needs Workers:Edit, D1:Edit, R2:Edit permissions |

### Per-monitor settings (set via admin dashboard)

| Field | Description |
|-------|-------------|
| `url` | The HTTP(S) endpoint or TCP socket (e.g., `tcp://example.com:5432`) to monitor. Not used by `push`, `push_down` or `manual` monitors |
| `monitor_type` | `http` (default), `tcp`, `keyword`, `push`, `push_down` or `manual` — see [Push, keyword and manual monitors](#push-keyword-and-manual-monitors) |
| `interval_minutes` | How often to check (1, 5, 10, 30). For `push` and `push_down` monitors it is the expected heartbeat interval / how long a trigger keeps the monitor down, and also allows 60, 360, 720 and 1440 (daily) |
| `timeout_ms` | Request timeout in milliseconds (default: 10000) |
| `expected_status_code` | Expected HTTP response code (optional — leave blank to accept any 2xx–3xx) |
| `retry_count` | Total check attempts before marking a site down (default: 3 — each failed attempt waits 2 s before retrying, so 3 attempts = up to 4 s before an incident fires) |
| `alert_webhook` | Slack or Discord incoming webhook URL for up/down alerts |
| `json_path` | Dot-notation path to extract from the JSON response body (e.g. `status.indicator`). Leave blank for plain HTTP monitoring. |
| `json_status_map` | JSON object mapping extracted values to `up`, `degraded`, or `down` (e.g. `{"none":"up","minor":"degraded","critical":"down"}`). Select the **Statuspage.io** preset in the admin to fill this automatically. |
| `keyword` | `keyword` monitors only: case-sensitive text that must appear in the first 512 KB of the response body |
| `manual_status` | `manual` monitors only: `up`, `degraded` or `down` |
| `grace_period_minutes` | `push` monitors only: how long past the expected interval a missed heartbeat is shown as degraded before the monitor goes down and alerts (default: 5) |

### Push, keyword and manual monitors

Pick the type when you add a monitor in the admin dashboard.

**Keyword** — like an HTTP monitor (same status-code, timeout and retry settings), but the check only passes if `keyword` appears in the response body. Matching is case-sensitive and only looks at the first 512 KB. A missing keyword shows as "Keyword not found". Not combinable with JSON monitoring.

**Push (heartbeat)** — for things that can't be polled, like cron jobs and backups. Saving the monitor generates a secret URL, shown in the monitor list (click it to copy):

```bash
# last line of your backup script, so it only runs when the backup succeeded
./backup.sh && curl -fsS -m 10 --retry 3 "https://<your-worker>/api/push/<token>"
```

- `GET`, `POST` and `PUT` all count. Add `?ping=255` to record a latency of 255 ms.
- A heartbeat marks the monitor up and resolves any open incident.
- If no heartbeat arrives within the expected interval the monitor turns **degraded** (no incident, no alert) for the grace period, then **down** with an incident and your alert webhook. A new monitor waits one full interval for its first heartbeat before anything happens, and shows "No data" until then.
- The status is re-evaluated on the monitor's own schedule, so a missed heartbeat is noticed at the first evaluation after interval + grace, not at that exact moment.
- If your client gets a 403 from Cloudflare, send a normal `User-Agent` header (some bot protections challenge requests that have none).
- Heartbeats arriving less than 10 seconds after the previous one are acknowledged but not recorded, and paused monitors ignore them.

**Upside-down push** (`push_down`) — the reverse: the monitor is up until its URL is called, then goes down (with an incident and alert) for one interval, then recovers by itself. Useful for "something went wrong" signals from a service that should normally stay silent.

**Manual** — no checks run; the status you set (`up`, `degraded` or `down`) is recorded every interval until you change it. Setting it to `down` opens an incident and fires the alert webhook like any other outage. Use it to publish a known outage or maintenance state. It always reports the status you set, whatever the real service is doing.

The push URL is the only credential for the heartbeat endpoint, which is deliberately unauthenticated so jobs don't need your `API_KEY`. It is a random token, separate from the monitor id (which public status pages expose), and is never shown on status pages or in alerts. See the [caveat below](#caveats) about treating it like a password.

### Per-status-page settings (set via admin dashboard)

| Field | Default | Description |
|-------|---------|-------------|
| `incident_history_days` | `30` | Number of days shown on the `/history` page — set to `30` or `90` |
| `min_incident_duration_minutes` | `0` | Hide resolved incidents shorter than this from public views (`0` = show all); set to `5`, `15`, `30`, or `60` |
| `header_template` | `centered` | Status page header layout — `centered` (default), `banner` (full-bleed brand-colored block), `compact` (inline header with a brand-colored underline), or `navbar` (full-bleed dark bar with live status countdown and RSS bell; the overall status summary floats over its bottom edge, above any notices) |
| `brand_color` | _(none)_ | Hex color (e.g. `#7c3aed`) applied to the header background/underline and site-wide accent links (RSS/history links); leave unset to use the default theme accent. Does not affect up/down/degraded status colors. |

---

## Development

```bash
npm run dev       # Start local dev server (wrangler dev, binds to http://localhost:8787)
npm run db:init   # Apply schema to local D1 (creates .wrangler/state/)
```

The admin dashboard is at `http://localhost:8787/`. Type-check without deploying:

```bash
npx tsc --noEmit
```

Code style:
- Strict TypeScript (`"strict": true` in `tsconfig.json`)
- No frontend build step — all HTML is inline template literals in `src/html/`
- No external runtime dependencies beyond `hono`
- `noUnusedLocals` and `noUnusedParameters` are enforced by the compiler

---

## Caveats

**D1 schema migrations are not automatic.**
`wrangler deploy` does not run `schema.sql`. Apply the schema manually with
`npm run db:init:remote` on first deploy, and run `ALTER TABLE` statements
via the Cloudflare D1 Console for any subsequent schema changes.

**Upgrading from an earlier version** requires the following manual `ALTER TABLE` statements in the D1 Console (safe to run on existing data — all columns have defaults):

```sql
ALTER TABLE incidents ADD COLUMN trigger_status_code INTEGER;
ALTER TABLE incidents ADD COLUMN trigger_error TEXT;
ALTER TABLE status_pages ADD COLUMN incident_history_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE monitors ADD COLUMN expected_status_code INTEGER;
ALTER TABLE monitors ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 3;
ALTER TABLE monitors ADD COLUMN json_path TEXT;
ALTER TABLE monitors ADD COLUMN json_status_map TEXT;
ALTER TABLE monitors ADD COLUMN monitor_type TEXT NOT NULL DEFAULT 'http';
ALTER TABLE monitors ADD COLUMN keyword TEXT;
ALTER TABLE monitors ADD COLUMN manual_status TEXT;
ALTER TABLE monitors ADD COLUMN grace_period_minutes INTEGER NOT NULL DEFAULT 5;
ALTER TABLE monitors ADD COLUMN push_token TEXT;
ALTER TABLE monitors ADD COLUMN last_heartbeat_at INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitors_push_token ON monitors(push_token);
ALTER TABLE checks ADD COLUMN degraded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE checks ADD COLUMN json_value TEXT;
ALTER TABLE status_pages ADD COLUMN min_incident_duration_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE status_pages ADD COLUMN header_template TEXT NOT NULL DEFAULT 'centered';
ALTER TABLE status_pages ADD COLUMN brand_color TEXT;
ALTER TABLE status_pages ADD COLUMN show_latency INTEGER NOT NULL DEFAULT 1;
```

Migration files for each schema change are kept in `migrations/` and can be applied with:

```bash
npx wrangler d1 migrations apply uptime-monitor --remote
```

**Run migrations before you deploy, not after.** The Worker's cron job writes to any table added by a migration on every check — if you deploy new code before applying its migration, cron starts erroring on that write until you catch up (harmless — it just means a gap in that table until you apply it — but worth avoiding). `deploy.yml` in this repo is manual-trigger by default (`workflow_dispatch`), so you're in control of the order either way: run `npx wrangler d1 migrations apply uptime-monitor --remote` first, then deploy. A fresh install doesn't need this — `schema.sql` already includes every table, and `setup.sh` / step 4 of the Deployment Guide applies it before the deploy step.

Migration `007_add_uptime_bucket_rollups.sql` (added in 1.6.2) is the one migration here that isn't a plain `ALTER TABLE` — it creates a new `uptime_bucket_rollups` table and backfills it from your existing `checks` data in the same statement, so the uptime bar and uptime% don't show a gap for the 30 days before you upgraded. Apply it the same way: `npx wrangler d1 migrations apply uptime-monitor --remote`.

Migration `012_add_push_keyword_manual_monitors.sql` adds the columns behind push, keyword and manual monitors (see [above](#push-keyword-and-manual-monitors)). Existing monitors become `http` monitors and keep working unchanged. Apply it before deploying, as above: until it is applied, creating a monitor fails.

Migration `008_add_show_latency.sql` adds a per-status-page toggle for the response time graph (`show_latency`, defaults to on — existing pages keep showing it unless you turn it off from the admin dashboard).

Migration `009_add_worker_health.sql` adds the `worker_health` table backing the self-monitoring health check. Unlike the other migrations, this one also needs a `wrangler.toml` change that isn't part of the migration itself: add a second cron trigger so the health check runs independently of the 1-minute check loop —

```toml
[triggers]
crons = ["* * * * *", "*/15 * * * *"]
```

Apply the migration before deploying the updated code, same rule as above — otherwise the health-check cron errors on every tick until the table exists.

**Push URLs are passwords.**
The `/api/push/<token>` endpoint needs no `API_KEY`, so anyone who learns a monitor's URL can fake heartbeats (or, for upside-down monitors, trigger outages). Keep the URL in your job's secret store rather than in a repo or shared log. There is no rotate button yet: to issue a new URL, delete and re-create the monitor. Heartbeats are not rate-limited beyond ignoring repeats within 10 seconds, so a leaked URL can also be used to write check rows.

**Custom domains require Cloudflare DNS — and no pre-created DNS records.**
`custom_domain = true` in `wrangler.toml` only works when the domain's zone is on Cloudflare DNS.
Wrangler creates the DNS record automatically on deploy — do not create it manually first or the
deploy will fail with `code: 100117`. For domains on external nameservers, use a CNAME pointing
to your `.workers.dev` URL and omit `custom_domain`.

**Cron triggers run from a single datacenter.**
Cloudflare cron triggers fire from the datacenter nearest to your D1 region — not
from multiple global locations. Check latency results reflect that single origin's network path.

**Public status pages can lag up to 65 seconds behind the latest check or incident update.**
Both public data endpoints (`/status/:slug/data`, `/status/:slug/history/data`) sit behind a
65-second Workers Cache API layer — just over the page's 60-second client-side auto-refresh
interval, so a visitor's own refresh loop can actually land on a cache hit instead of missing
every single time. The underlying data can't change faster than the cron interval (1 minute
minimum) anyway, and status pages can have many concurrent viewers. A new check result, resolved
incident, or notice may take up to 65s to appear on the public page — the admin dashboard is not
cached and always reflects live data.

**The admin dashboard has no authentication UI.**
All admin API routes require an `X-API-Key` header matching the `API_KEY` secret. The
dashboard reads this key from a value you enter in the browser. Do not expose the Worker
URL without this protection.

**Some targets rate-limit Cloudflare shared IPs.**
GitHub Pages and several CDNs throttle requests from Cloudflare's shared IP ranges at
short intervals. Use 5-minute or longer check intervals (`interval_minutes >= 5`) for
those targets to avoid false positives from rate-limit responses (HTTP 429).

---

## Using with Claude Code

This project includes a `CLAUDE.md` that gives Claude Code complete context: commands,
architecture, key files, and gotchas specific to the Workers + D1 runtime.

```bash
claude    # Start Claude Code — reads CLAUDE.md automatically
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the fork-and-PR workflow, code style guidelines,
and how to report issues or vulnerabilities.

---

## License

MIT — see [LICENSE](LICENSE).
