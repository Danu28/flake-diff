# Security Policy

## Privacy Design
- `redact=true` by default: storage/cookies emit `valueHash` only, no raw values or `preview`. HTML inputs are `[REDACTED]`.
- Offline-only: extension has `permissions: []`, `host_permissions: []`, no network. `app.html` works as `file://`.
- Budgets prevent DoS: 5 MB file guard in extension, 1 MB JSON, 20k htmlSnippet.

## Supported Versions
| Version | Supported |
|---|---|
| 1.0.x | ✅ |

## Reporting a Vulnerability
- **Do not** open a public issue for security bugs.
- Email: dhanushkanchan28@gmail.com with `Subject: [SECURITY] Flake Diff` + repro + snapshot sample (redacted).
- We aim to respond within 72h and patch within 14 days. You’ll be credited in `SECURITY.md` unless you opt out.

## Hardening Checklist (for contributors)
- Never log raw storage/cookie values.
- `escape()` all `htmlSnippet`/`bodyText` before `innerHTML`.
- Keep `MAX_FILE_SIZE` 5 MB in `app.js`.
- Validate `schemaVersion` before diff.
