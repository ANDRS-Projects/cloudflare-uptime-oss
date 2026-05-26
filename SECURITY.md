# Security Policy

## Dependency management

- All dependencies are pinned via `package-lock.json` — committed to git
- CI runs `npm ci` (frozen install) to ensure lockfile is always honoured
- Dependabot is enabled for automated CVE PRs

## CI security scanning

| Tool | Workflow | Trigger |
|---|---|---|
| Trivy | `.github/workflows/trivy.yml` | push, PR, weekly Monday |
| Gitleaks | `.github/workflows/gitleaks.yml` | push, PR |

Trivy fails the build on unfixed CRITICAL CVEs. Gitleaks fails the build on any detected secret.

## Reporting a vulnerability

Please open a private security advisory in the GitHub Security tab of this repository.
