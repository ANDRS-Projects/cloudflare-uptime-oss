# cloudflare-uptime

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Deploy](https://github.com/ANDRS-Projects/cloudflare-uptime/actions/workflows/deploy.yml/badge.svg)](https://github.com/ANDRS-Projects/cloudflare-uptime/actions/workflows/deploy.yml)

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

- **Multi-monitor support** — track any HTTP endpoint with configurable check intervals and timeouts
- **Public status pages** — shareable `/status/:slug` pages with live up/down status per monitor
- **90-day latency history** — sparkline graph built from the rolling check history
- **Incident timeline** — timestamped incidents with the triggering HTTP status code or error message
- **RSS feed** — `/status/:slug/rss` for incident subscribers
- **Custom logo per page** — upload a logo to R2; served through the Worker with immutable cache headers
- **Custom domain routing** — each status page can be served on its own domain via `wrangler.toml` routes
- **Admin dashboard** — add/edit/delete monitors and status pages, view check history
- **Slack and Discord webhook alerts** — per-monitor webhooks fire on incident open and close
- **Maintenance notices** — create notices that appear on status pages; resolved notices stay visible for 24 hours with a "Resolved" badge
- **Cron-based checks** — Cloudflare cron triggers run the check loop on your configured schedule
- **R2 asset storage** — logo uploads stored in and served from Cloudflare R2
- **CI/CD via GitHub Actions** — add `CLOUDFLARE_API_TOKEN` as a repo secret and trigger deploys manually (or change the workflow trigger to auto-deploy on push)
- **Security scanning** — Trivy (dependency CVEs) and Gitleaks (secret detection) run on every push

---

## Screenshots

<img width="1200" height="675" alt="drop-kit-landscape-1779790200368" src="https://github.com/user-attachments/assets/24cefe6b-8945-431b-bdac-140e35fd4a18" />
<img width="1200" height="675" alt="drop-kit-landscape-1779791596122" src="https://github.com/user-attachments/assets/5939865b-11f8-420e-8413-f6eeddec0729" />
<img width="1200" height="675" alt="drop-kit-landscape-1779791697387" src="https://github.com/user-attachments/assets/fbd14c50-8304-4d87-8908-275f5894f4c7" />



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

### 5. Create the R2 bucket

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

To serve a status page on `status.yourdomain.com`, add a `[[routes]]` block to `wrangler.toml`:

```toml
[[routes]]
pattern = "status.yourdomain.com"
custom_domain = true
```

Then redeploy with `npm run deploy`. The domain must already be on Cloudflare DNS (orange-clouded / proxied). If your domain uses external nameservers, point a CNAME at your `.workers.dev` URL instead — `custom_domain = true` will not work in that case.

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

### GitHub Actions secrets (CI/CD)

| Secret | Required | Description |
|--------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | Needs Workers:Edit, D1:Edit, R2:Edit permissions |

### Per-monitor settings (set via admin dashboard)

| Field | Description |
|-------|-------------|
| `url` | The HTTP(S) endpoint to monitor |
| `interval_minutes` | How often to check (1, 5, 10, 15, 30, 60) |
| `timeout_ms` | Request timeout in milliseconds (default: 10000) |
| `alert_webhook` | Slack or Discord incoming webhook URL for up/down alerts |

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

**Custom domains require Cloudflare DNS.**
`custom_domain = true` in `wrangler.toml` only works when the domain is proxied
(orange-clouded) through Cloudflare DNS. For domains on external nameservers,
use a CNAME pointing to your `.workers.dev` URL and omit `custom_domain`.

**Cron triggers run from a single datacenter.**
Cloudflare cron triggers fire from the datacenter nearest to your D1 region — not
from multiple global locations. Check latency results reflect that single origin's network path.

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
