# Contributing to cloudflare-uptime

Thank you for your interest in contributing. This document covers everything you need
to get from a fresh clone to an open pull request.

---

## Development Setup

### 1. Fork and clone

```bash
git clone https://github.com/YOUR_USERNAME/cloudflare-uptime.git
cd cloudflare-uptime
npm install
```

### 2. Authenticate with Cloudflare (optional for local dev)

For local development with `npm run dev`, Wrangler creates a local D1 and R2 simulation
in `.wrangler/state/` — no Cloudflare account required.

```bash
npm run dev          # Start local Worker at http://localhost:8787
npm run db:init      # Apply schema.sql to local D1
```

If you want to test against a real Cloudflare environment, run `npx wrangler login`
and follow the full [deployment guide in README.md](README.md#deployment-guide).

### 3. Type-check

```bash
npx tsc --noEmit
```

There is no test runner configured. Manual verification against a local or staging
Worker is the expected workflow.

---

## Branch and PR Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
   Branch naming conventions:
   - `feat/` — new functionality
   - `fix/` — bug fixes
   - `chore/` — dependency updates, CI changes, non-functional edits

2. **Make your changes.** Keep commits focused — one logical change per commit.

3. **Verify type safety:**
   ```bash
   npx tsc --noEmit
   ```

4. **Push and open a PR against `main`:**
   ```bash
   git push origin feat/your-feature-name
   ```
   Then open a pull request on GitHub. The CI suite (deploy check, Trivy, Gitleaks)
   runs automatically on every PR.

5. **PR checklist:**
   - [ ] `npx tsc --noEmit` passes with no errors
   - [ ] No new runtime dependencies added without discussion
   - [ ] If `schema.sql` changed: include migration instructions in the PR description
   - [ ] If `wrangler.toml` changed: document what the field does in the PR description

---

## Code Style

- **TypeScript strict mode** — `"strict": true` plus `noUnusedLocals` and
  `noUnusedParameters` are enforced. The compiler is the linter.
- **No frontend build step** — all HTML is returned as tagged template literals from
  `src/html/admin.ts` and `src/html/status.ts`. Do not introduce Vite, webpack, or
  any other bundler.
- **No additional runtime dependencies** beyond `hono` without a strong reason.
  Cloudflare Workers have a 1 MB compressed script size limit.
- **Single-file SQL** — all D1 queries live in `src/db.ts`. Do not scatter
  `.prepare()` calls across route handlers.
- **Fire-and-forget alerts** — alert failures in `src/alerts.ts` are silently caught.
  Do not add retry logic that could block the check loop.
- **No `any`** — if you need to escape the type system temporarily, use `unknown`
  with a type guard.

---

## Schema Changes

`schema.sql` is the authoritative schema and is applied once with `wrangler d1 execute`.
Wrangler does not run migrations automatically on deploy.

If your change requires a schema update:
1. Add the `ALTER TABLE` statement to your PR description.
2. Do not modify the existing `CREATE TABLE` statements in `schema.sql` unless you are
   adding a brand-new table.
3. Downstream users will need to run your `ALTER TABLE` statement manually via the
   Cloudflare D1 Console.

---

## Reporting Issues

Please use the GitHub issue templates:
- [Bug report](.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature request](.github/ISSUE_TEMPLATE/feature_request.md)

For security vulnerabilities, open a **private security advisory** via the GitHub
Security tab — do not file a public issue. See [SECURITY.md](SECURITY.md) for details.

---

## Using Claude Code

This project includes a `CLAUDE.md` file at the root. When you open the project in
Claude Code, it reads that file automatically and has full context on the architecture,
commands, and gotchas.

```bash
claude    # Start Claude Code in the project directory
```

Useful for: navigating the codebase, drafting D1 query changes, reviewing PRs,
or getting a quick explanation of the cron scheduling logic.
