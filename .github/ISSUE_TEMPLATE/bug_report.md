---
name: Bug report
about: Something is not working correctly
labels: bug
---

## Describe the bug

<!-- A clear and concise description of what the bug is. -->

## Steps to reproduce

1.
2.
3.

## Expected behaviour

<!-- What you expected to happen. -->

## Actual behaviour

<!-- What actually happened. Include any error messages from the browser console, Worker logs (wrangler tail), or the Cloudflare dashboard. -->

## Environment

| Field | Value |
|-------|-------|
| Wrangler version | <!-- `npx wrangler --version` --> |
| Node.js version | <!-- `node --version` --> |
| D1 schema version | <!-- Date you last applied schema.sql or an ALTER TABLE, e.g. "initial schema, 2026-03-01" --> |
| Cloudflare region / datacenter | <!-- Shown in `wrangler tail` output, e.g. "DFW" --> |
| Browser (if UI issue) | <!-- e.g. Chrome 124, Safari 17 --> |
| Operating system | |

## Relevant logs

<!-- Paste output from `npx wrangler tail` or the Cloudflare Workers dashboard Logs tab. Remove any API keys or secrets before pasting. -->

```
(paste logs here)
```

## Additional context

<!-- Any other information that might help: custom domain routing, R2 configuration, specific monitor URL patterns, alert webhook behaviour. -->
