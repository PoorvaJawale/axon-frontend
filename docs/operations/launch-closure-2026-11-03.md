# Remaining launch gates and closure evidence — 3 November 2026

This reconciles the original checklist against current code, live-operation receipts and isolated acceptance. PR #5 is already merged into main at `159b0ff409d1c0255e63bad3d7db69f1984f4ecb`. The changes below belong to its follow-up branch; they are not deployed merely because staging passes.

## Defects fixed in this continuation

- Alerts previously stopped at the newest 200 rows and computed severity counts from that truncated sample. The route now filters, counts and paginates in tenant-scoped SQL within one consistent read snapshot. Reviewed, Unreviewed and All have exact totals; an out-of-range page clamps after reviews. Overview requests one alert rather than an unnecessary large list.
- Clerk session tokens now have explicit authorized parties from the configured canonical origin and the exact trusted Vercel deployment URL. Development localhost origins are excluded from production. Request Host/Forwarded headers cannot choose this list. Browser-issued sessions are used in acceptance; origin-less backend-created test sessions are no longer used to bypass this check.
- Account deletion now writes an authenticated encrypted recovery tombstone before deleting application data. A missing key, failed write or bad receipt stops deletion. The separate ledger allows a restore older than a deletion request to be checked even after the database's own minimal deletion receipt expires.
- Added negative verified-email provisioning coverage, large alert queues, callback ownership and real session subscription ownership checks. Original downloaded workflow exports and production data were not changed for these tests.

## Acceptance and evidence

`tests/account-routes.test.cjs` covers 331 alerts across pages, exact severity totals, all three review filters, reload persistence, invalid inputs, last-page clamping and another tenant. It also checks callback registration/verification/deletion ownership without contacting a real customer destination. `tests/key-provisioning.test.cjs` checks that an unverified primary email creates neither a key nor allowance. `tests/auth-origins.test.cjs` covers canonical/deployment origins and development-only localhost behavior.

`node scripts/staging-session-isolation.cjs` uses separate real Clerk development browser sessions and localhost data. It checks A/B/A reads, revocation/review boundaries, saved review filters, callback ownership and read-only access denial for an existing sandbox subscription belonging to another account. It performs no charge or real callback delivery. Synthetic identities and their exact local fixtures are removed.

`node scripts/staging-browser-isolation.cjs` checks real Chrome A → sign out → B → sign out → A, rendered isolation over 60 painted frames per account, 331-alert pagination, review/reload/filter behavior, and desktop/mobile rendering. Screenshots contain synthetic fixtures only and remain private under `.cache/staging`.

`tests/privacy-ledger.test.cjs` checks actual authenticated encryption, wrong keys, tampering, idempotency, identity mismatch and refusal to reactivate a deleted identity in a restored snapshot. `tests/privacy-operations.test.cjs` proves a ledger failure prevents application-data deletion. No real account deletion or production restore was performed.

Earlier evidence remains in [production inspection](production-inspection-2026-11-01.md) and [acceptance](launch-acceptance-2026-11-03.md): atomic quota races, durable jobs, signed callback/SSRF tests, sandbox checkout/replay/cancellation, native 32 + 12 synthetic model cases, mock soak, authenticated backups/offline restore drills, least-privilege roles, dependency checks and stateful failure/recovery notifications. Historical receipts are not a guarantee that future provider events will succeed.

The explicit `npm run launch:preflight -- --public-launch` check rejects development or mismatched Clerk keys, a missing owned HTTPS host and test-mode paid-launch configuration. It does not change the beta environment or establish DNS ownership/identity continuity.

Browser follow-up: the full A/B/A run passed ten checks including the 331-alert flow. A repeated run timed out during its first sign-out; a focused synthetic-account confirmation then passed alert pagination, loaded mobile rendering, frame isolation and sign-out. That interruption is recorded rather than treated as another successful full run.

## Still required before wider public launch

| Gate                                        | Current state                                                                                                           | Next action                                                                                                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production identity and owned domain        | Public frontend still uses a Clerk development instance. Owner confirmed no domain purchased.                           | Follow [production identity transition](production-identity-transition.md). Choose and obtain a domain, verify DNS, prepare a production Clerk instance and reviewed identity migration. Do not simply replace keys and strand paid accounts. |
| Offsite recovery and separate key custody   | Local encrypted backups and offline restore drills pass. Approved Drive account is full; no upload succeeded.           | Owner must free storage or explicitly choose another private destination, and choose protected separate key custody. Do not upload the decryption key with backups or retry unchanged quota failures.                                         |
| Account-specific provider controls and cost | API optional response storage is disabled; no zero-retention claim. Admission/token/concurrency caps are implemented.   | Owner reviews OpenAI project sharing/retention and spend/recharge controls. Admission caps are not a currency budget. No provider plan upgrade is required by this checklist.                                                                 |
| Policies and seller details                 | Individual operator Poorva Kiran Jawale, India; support axonapi2026@gmail.com. No registration/postal address invented. | Appropriate policy/seller-disclosure review before broad paid marketing. If that review needs a postal address, email alone does not establish one. No legal approval is claimed.                                                             |
| Representative beta observations            | Synthetic model/capacity and sandbox lifecycle acceptance pass.                                                         | Observe a small real cohort and natural provider billing transitions; collect latency/errors/queue age/token cost/false-block feedback before increasing limits. No accuracy, customer capacity or SLA is inferred from synthetic samples.    |
| This follow-up release                      | Local implementation and review in progress.                                                                            | Require final tests, CI, reviewed merge and canonical deployment verification.                                                                                                                                                                |

Growth tasks (dedicated queue/API, SSO, multiregion, enterprise SLA) remain conditional on actual demand. They are not silently implemented or purchased to close an MVP checkbox.

## Deletion-safe recovery procedure

The privacy operator writes minimal encrypted user/request/time tombstones under the approved `D:\axon-frontend\.cache\production-backups\privacy-tombstones` folder, using the existing separately held backup key. These records contain no agent content. They are outside automatic source-backup rotation; retain them while any older recoverable snapshot or hold could reintroduce those identities. Review their retention and protected separate-copy custody alongside held archives. Current offsite quota failure also affects ledger recovery planning; do not claim redundancy.

Before enabling an offline restore, review deletions predating adoption of this ledger and reconcile them from existing restricted operator/provider records. A missing ledger is an operator-review failure, not proof that no deletions occurred. Never create an empty folder merely to pass a restore gate. Obtain a verified ledger from approved custody; if no deletions have ever completed, an operator must establish and document that baseline.

Read-only check, after reviewing legacy deletions and with the existing recovery container already running in network-none mode with no ports:

```powershell
node scripts/privacy-recovery-check.cjs axon_restore18_<16-hex-suffix> --legacy-deletions-reviewed
```

The helper accepts only the pinned offline container and application restore naming pattern, authenticates every receipt, checks account/key/log/reservation/job/callback/review/checkout rows, and returns only sanitized counts. It does not start a container, restore data, delete rows, change a schema or approve activation. A match means keep recovery offline and perform separately reviewed deletion reconciliation. Both the deletion ledger and retained billing/support data need operator review; this command does not erase financial/legal retention records.

## Final local verification

All 94 source regression tests passed, with no skips; ESLint and TypeScript passed, all 13 generated-workflow contracts passed, and the production build completed. The production dependency audit reported zero vulnerabilities. The scoped Impeccable detector returned no findings for the changed dashboard pages. Loaded desktop/mobile screenshots were visually reviewed. No live payment, real account deletion, provider-settings change, model call or production deployment was needed for these checks.
