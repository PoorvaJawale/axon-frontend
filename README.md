# Axon

AI action validation with a session-authenticated dashboard, account-level quotas and optional signed delivery to verified destinations.

## Architecture

- Next.js 16 / React on Vercel: public pages, Clerk-authenticated dashboard, SQL control plane and signature-verified Razorpay handlers.
- Railway PostgreSQL: authoritative quotas, hashed keys, review state, durable jobs and billing-event/checkout deduplication. Separate restricted web/validator logins use verified TLS.
- Railway n8n/private external runner: structural checks, atomic reservations, bounded GPT-4o mini evaluation, background recovery and optional signed delivery. Main/runner images are pinned to matching 2.45.7 digests.
- Free: 100 lifetime validations. Pro: ₹799/month, 5,000 validations per paid billing period across all keys. Review existing paid commitments separately before migration.

In `validate_only`, the customer owns execution. In `validate_and_dispatch`, Axon delivers to a verified public HTTPS destination with signatures, pinned DNS/IP and no redirects. The destination must prevent duplicate execution. A model verdict is not a safety guarantee or independent fact verification.

## Development and checks

Use Node 22 or 24. Read `AGENTS.md` and the installed Next.js guides before framework changes.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run audit:production
npm run build
```

Copy `.env.example` into an ignored environment file and use dedicated development credentials. Never commit credentials, `.cache`, `.clerk`, backup keys or plaintext production exports. Production database connections require `sslmode=verify-full` and a trusted CA; do not disable certificate checks.

Follow [staging instructions](backend/staging/README.md) for isolated Docker and separate Clerk/Razorpay test configuration. A Production-environment Vercel candidate uses real production settings even before domain promotion; it is not a sandbox.

## Deployment and operations

Only the three top-level hardened workflow exports are replacements; `reference/` exports are historical evidence. Original owner-supplied exports remain untouched. Apply reviewed migrations/grants after a verified backup/restore rehearsal, configure restricted logins/TLS and server-only settings, then coordinate workflow/frontend cutover. Keep image digests pinned and Code environment access blocked.

Current state and evidence are in [production operations](docs/operations/production-inspection-2026-11-01.md); [launch handoff](docs/operations/launch-handoff-2026-10-31.md) records implementation history. Operator scripts are pinned to the owner's project: inspect before running. Never restore over production as a routine rollback or reset usage to undo a release.

## Monitoring, recovery and release limits

`/api/health` checks the web server; `/api/status` reports bounded, sanitized web/backend/database checks. Neither measures model safety or historical uptime.

After the workflow is on the default branch, independent GitHub Actions checks run every 30 minutes without production DB/provider credentials. Stale, unknown, degraded or failed checks fail the run. Set repository variable `AXON_ENABLE_SCHEDULED_MONITOR=false` to disable them. Verify actual GitHub notification delivery separately.

Encrypted recovery copies and their separate key live under ignored D: folders. Offline application and n8n metadata restores on PostgreSQL 18 have passed. Daily local backup automation is configured for 04:00 IST and requires the computer/Codex environment to be available. The approved private Drive upload is blocked by that account's storage quota; no offsite copy is claimed. Local copies alone are not disaster recovery.

Passing checks and synthetic smoke results are not an enterprise compliance certification, measured SLA or production accuracy/capacity guarantee. Remaining provider lifecycle, browser isolation, load and recovery gates are recorded in operations. Public support: axonapi2026@gmail.com.
