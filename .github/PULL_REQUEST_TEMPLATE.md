## What changed

<!-- What does this PR do, and why? -->

## Verification

<!-- How did you confirm this works? npm run typecheck output, manual testing steps,
     wrangler dev screenshots, etc. For changes to src/html/admin.ts or src/html/status.ts,
     note that tsc --noEmit alone doesn't catch broken inline JS — see the escaping gotcha
     in AGENTS.md if you touched the inline <script> content. -->

## Migration / config changes

<!-- Does this need a new migrations/NNN_*.sql file, a wrangler.toml change (routes, crons,
     bindings), or a new secret? If yes, describe the upgrade steps for existing installs.
     If no, delete this section. -->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] README updated if this changes setup/config/upgrade steps
- [ ] No new schema/migration needed, or a `migrations/NNN_*.sql` file is included
