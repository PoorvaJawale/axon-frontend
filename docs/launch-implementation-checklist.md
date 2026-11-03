# Axon launch implementation checklist

Current reconciliation: [3 November closure evidence and remaining gates](operations/launch-closure-2026-11-03.md). Production identity/domain, offsite recovery, provider account controls, policy review and representative beta observations remain open.

Earlier continuation: [3 November acceptance and operations](operations/launch-acceptance-2026-11-03.md). Real browser isolation, expanded native model evaluation, billing regressions, stateful alerts and approved guarded backup rotation now have additional evidence there. Offsite storage and external account/policy review remain distinct.

Implementation record (1 November 2026): checked items have implementation/test/deployment evidence in [production operations](operations/production-inspection-2026-11-01.md) and [the launch handoff](operations/launch-handoff-2026-10-31.md). Unchecked items retain an external, broader acceptance or future-growth requirement; passing source tests alone does not close them.

Prepared: 19 October 2026. Intended start: 20 October 2026 (Asia/Kolkata).
Source: [Launch-readiness review](launch-readiness-2026-10-19.md).

This is the implementation backlog extracted from the report. It has been updated against implementation and acceptance evidence. Checked items record the tested scope; external requirements remain open. Existing working controls should be preserved and regression-tested.

## How we will work

- Start with the current live system, not the older August exports. Mark an issue verified already fixed when fresh evidence and a test prove it; do not rewrite it unnecessarily.
- Implement in staging/test mode first, with a known rollback. Do not test payments, data deletion, failure injection or load against real customers.
- Complete critical security gates before wider traffic. Close launch requirements before paid release; defer infrastructure that only measured growth requires.
- Record each completed task's commit/workflow revision, test result and deployment check. A checked box without evidence does not close a finding.
- Preserve Free = 100 lifetime validations and Pro = ₹799/month for 5,000 validations per paid billing period unless you explicitly change the product terms.

## Workstream 0 — Establish the baseline and product contract

### BASE-01: Obtain current production evidence

- [x] Export the current validationproject, Background Semantic Validator, API Key Workflow, Billing Update, Usage API, Logs API, Alerts API, API Keys API, Revoke Key API, Monthly Usage Reset, Error Handler and Axon Health workflows.
- [x] Capture schema definitions, quota/reservation functions, indexes, constraints and migration history without customer records or secret values.
- [x] Record actual Railway/n8n version, execution mode, worker/replica count, connection limits, retention and backup settings; Vercel/Clerk/Razorpay environment modes and relevant security settings.

**Complete when:** each report finding is labeled current defect, verified fixed, or configuration still unverified, with its current source/revision. Source: all findings.

### BASE-02: Prepare safe implementation and recovery

- [x] Create a staging/test setup with separate credentials, sandbox payment configuration and two test accounts.
- [x] Take a verified backup before database changes; record the current deployment/workflow versions and rollback steps.
- [x] Keep sanitized workflow exports and reviewed schema/migration changes in version control. Never commit raw credentials, customer data or execution dumps.

**Complete when:** changes can be tested and rolled back without disrupting customers. Source: F05, F08, F11, F12 and release criteria.

### BASE-03: Write down three decisions before dependent changes

- [x] Decide whether the API only validates or also dispatches the action. There must be one owner of execution.
- [x] Confirm Free feature access and which outcomes consume quota: valid decisions, schema failures, skipped requests, internal failures and retries.
- [x] Confirm actual content-retention periods and whether zero-content-storage is a real supported mode or a claim to remove for launch.

**Complete when:** code, workflows, documentation, pricing and tests use the same decisions. These choices must not silently alter existing paid commitments. Source: F04–F07.

## Workstream 1 — Critical security fixes

### SEC-01: Patch affected dependencies

- [x] Recheck current advisories and choose maintained patched versions of Next.js/Nodemailer and affected transitive dependencies.
- [x] Update compatible packages and lockfile using the relevant installed Next.js migration guidance; avoid a blind force-upgrade.
- [x] Run build, lint, existing tests and sign-in/payment/image/status regression checks.

**Where:** package.json, package-lock.json, Next.js configuration as required.
**Complete when:** launch-relevant critical/high advisories are remediated; any remaining finding has a documented exposure analysis and release decision. Source: F01.

### SEC-02: Isolate trusted context from judge output

- [x] Replace broad model-result object spreading with a separate validated judge object in both synchronous and background parsers.
- [x] Accept only the documented verdict/risk/confidence/category/reason fields; validate enums, ranges and string lengths; reject unexpected fields.
- [x] Preserve tenant ID, original body/destination, request ID and signing credentials outside model-controlled data.
- [x] Keep model errors, malformed output and unexpected fields from producing an unverified PASS.

**Where:** validationproject → Code in JavaScript11; Background Semantic Validator → Parse Judge1 and consumers.
**Complete when:** synthetic model output containing user_id, body, request_id or webhook_secret cannot change any trusted field, including logs and callbacks. Source: F02.

### SEC-03: Restrict outbound destinations

- [x] Implement verified tenant HTTPS callback destinations if dispatch remains supported.
- [x] Parse URLs correctly; reject credentials, unsafe schemes, private/reserved destinations and alternative numeric/IPv6 representations.
- [x] Protect the actual DNS-resolved connection and egress path; do not rely on a one-time string or DNS check.
- [x] Disable redirects or validate every redirected destination; enforce outbound timeout and response-size limits.
- Not applicable: the owner chose both validate-only and verified forwarding. Both remain explicit modes with one execution owner per request.

**Where:** validator input guard, every synchronous/background HTTP callback node, destination settings and network configuration.
**Complete when:** staging tests cover alternative IP forms, private DNS results and unsafe redirects; unapproved destinations cannot be contacted. Source: F03.

### SEC-04: Make callbacks authentic and unambiguous

- [x] Sign the exact transmitted bytes using the correct tenant secret; remove constant/missing-secret fallback behavior.
- [x] Include and document timestamp/event ID verification and replay rejection.
- [x] Make the receiving integration idempotent; separate execution messages from blocked-output alerts.
- [x] Distinguish validation verdict, delivery result and downstream execution result. Do not report delivery success after a failed callback.

**Where:** synchronous/background callback payload builders, signing nodes and integration examples.
**Complete when:** a sample receiver verifies the actual payload, rejects tampering/replays, and does not execute BLOCK alerts or duplicated events. If dispatch is removed, document which callback tasks are genuinely not applicable. Source: F04.

## Workstream 2 — Identity, authorization and API hardening

### AUTH-01: Separate dashboard access from customer keys

- [x] Authorize dashboard reads using verified user identity and a narrowly scoped internal service mechanism rather than the latest customer API key.
- [x] Keep key hashes for validation; minimize retained plaintext keys and avoid putting secrets into execution logs.
- [x] Define rotation, expiry and recovery behavior, including the existing exported 90-day key expiry.
- [x] Replace the one broad administrative secret with appropriately scoped internal permissions/credentials where needed.

**Where:** lib/axon.ts, key provisioning, relevant n8n data/admin endpoints and Clerk private metadata.
**Complete when:** revoking/expiring every customer key does not prevent the signed-in owner from managing their account and creating a replacement. Source: F09.

### AUTH-02: Enforce tenant boundaries and clear session caches

- [x] Derive tenant/owner IDs only from authenticated sessions or verified API keys; enforce ownership on every resource query/mutation.
- [x] User-scope dashboard SWR keys and clear auth/secret/cache state when identity changes.
- [x] Test cross-account reads, revocations, subscription access and callback changes using two staging users.

**Where:** AuthContext, dashboard fetch hooks, server routes, backend SQL.
**Complete when:** account B cannot see or alter account A's data and switching accounts does not display cached secrets/data. Source: F02, F09 and release criteria.

### API-01: Add resource and cost controls

- [x] Shared per-key/account/IP burst limits, bounded active jobs and fair per-tenant concurrency.
- [x] Request/body/field-size limits and model input/output-token caps before expensive processing.
- [x] Bounded retries with backoff and defined global spend/failure safeguards.
- [x] Limits on key creation and checkout attempts; validated/capped contact fields and bot/spam protection.
- [x] Verified-email provisioning is enforced and negatively tested; actual Free native semantic checks pass.
- [ ] Configure and verify production Clerk signup/email/bot settings after owned-domain setup; current instance is development.

**Where:** public validation ingress, server mutation routes, SMTP contact endpoint, model nodes and deployment controls.
**Complete when:** staging burst/oversized/spam/retry tests stay within resource and spend bounds without starving another tenant. Source: F06.

### API-02: Harden browser/server request handling

- [x] Add bounded timeouts to remaining backend/provider fetches; normalize errors and bound pagination/ID inputs.
- [x] Explicitly prevent sensitive authenticated responses from being publicly cached.
- [x] Verify actual cookie/Clerk CSRF protections; enforce expected origins for browser mutations without breaking signature-authenticated provider webhooks.
- [x] Add tested CSP, framing restrictions, nosniff, Referrer-Policy and Permissions-Policy while preserving Clerk/Razorpay/Next.js behavior.

**Where:** next.config.ts, lib/axon.ts, server routes and middleware/configuration as appropriate.
**Complete when:** auth and checkout still work, sensitive responses are not shared, invalid inputs fail predictably and security headers are verified on the deployed responses. Source: F12.

## Workstream 3 — Quotas and billing correctness

### QUOTA-01: Make allowance enforcement atomic

- [x] Verify/update the live account quota/reservation functions; use one atomic check-and-reserve operation with unique request identity.
- [x] Finalize/release reservations consistently with BASE-03's outcome policy.
- [x] Share one allowance across keys, prevent retry double-counting and preserve usage through revocation and plan changes.
- [x] Keep Free lifetime usage out of monthly resets. Reset Pro usage only on a genuinely new paid billing period.
- [x] Synchronize key creation, Usage API, billing updates and existing records to 100/5,000 without erasing usage or breaking paid commitments.

**Where:** DB migrations/functions and validation, usage, creation, billing and reset workflows.
**Complete when:** parallel requests at the limit cannot overshoot; retries/new keys cannot create extra allowance; dashboard usage agrees with enforcement; duplicate events cannot refill a period. Source: F05.

### BILL-01: Prevent duplicate subscription creation

- [x] Store durable subscription/entitlement state and serialize or deduplicate creation per account.
- [x] Keep existing amount, ownership, paid-period and signature checks intact.
- [x] Return the existing usable/pending subscription during concurrent/retried checkout attempts.

**Where:** razorpay-subscribe route, database state and Clerk synchronization.
**Complete when:** simultaneous create requests result in one intended subscription, not multiple subscriptions. Source: F08.

### BILL-02: Reconcile payment events and account entitlements

- [x] Persist processed event identities and make billing-period transitions idempotent.
- [x] Handle duplicate/reordered events and partial PostgreSQL/Clerk failures with retryable reconciliation.
- [x] Verify cancellation at period end and define refund/dispute/legacy-subscription handling and support recovery.
- [x] Verify production Razorpay mode, webhook subscription/events and ₹799 monthly plan configuration without making unnecessary live payments.

**Where:** payment webhook/activation/cancellation routes, billing workflow and durable event/entitlement records.
Cancellation evidence covers sandbox acknowledgment and automated terminal-period cases; future natural live transitions remain beta observation.

**Complete when:** sandbox end-to-end tests cover paid-but-not-activated recovery, duplicate events, cancellation, mismatched ownership and interrupted synchronization without double charging or resetting usage. Source: F08.

## Workstream 4 — Privacy and accurate launch promises

### PRIV-01: Enforce retention and deletion

- [x] Inventory user identity, keys, agent content, metadata, model data, n8n execution data, error logs, payment IDs and backups.
- [x] Redact secrets/sensitive content before persistence and minimize content sent to the model.
- [x] Implement tested retention/deletion jobs and an account export/deletion process; set deliberate n8n execution saving/pruning and staff-access rules.
- [x] Verify deployed endpoint/optional store:false configuration and remove any zero-retention promise.
- [ ] Owner confirms account-specific provider sharing/retention controls; API settings alone do not establish those controls.
- [x] Define backup retention and how deletion requests interact with backups.

**Where:** log insert nodes, DB cleanup/deletion jobs, server data endpoints, provider settings and operations documentation.
**Complete when:** the advertised retention period is actually enforced, deletion is verified, raw keys/content are not retained accidentally, and any zero-retention claim is supported end to end. Source: F07.

### PRIV-02: Publish accurate policy and feature information

- [x] Replace placeholder Privacy/Terms links with real policies; publish refund/cancellation/support information and relevant subprocessor disclosures.
- [x] Verify or remove/qualify 99.9% uptime, immutable logs, custom schemas, three-layer fail-closed execution, Slack/PagerDuty, SOC 2 progress, zero retention, enterprise SLA and on-premise claims.
- [ ] Align plan features/retention, support commitments and deployed capabilities; obtain appropriate review of legal wording before publication.

**Where:** footer, hero, features, pricing, billing copy, policy pages and documentation.
**Complete when:** every launch-facing promise has implementation/operational evidence, or is clearly described as planned rather than available. Source: F07, F12.

## Workstream 5 — Data and background reliability

### DATA-01: Fix log queries, statistics and API contracts

- [x] Move filtering, bounded pagination and aggregate/time-window counts to tenant-scoped DB queries.
- [x] Preserve async outcomes instead of converting all non-PASS rows to BLOCK.
- [x] Make 24-hour metrics use an actual 24-hour filter and remove sample-limited totals.
- [x] Remove or isolate legacy public mock /api/logs and /api/alerts routes.
- [x] Make examples use one verified API base URL, complete fields, actual response shapes and the BASE-03 execution contract.

**Where:** Logs API, server log proxy, dashboard overview/logs, public/demo routes and all integration examples.
**Complete when:** more than 200 mixed-age/mixed-result records produce correct pages/counts; an example copied from docs works in staging; synthetic events cannot be confused with production data. Source: F04, F10.

### DATA-02: Persist alert review accurately

- [x] Store tenant-scoped review state, actor and time; implement the review mutation.
- [x] Return success only after persistence and show the actual blocked output where supported.
- [x] Verify Reviewed/Unreviewed/All filters and reload behavior.

**Where:** validation log/review schema, Alerts API, server alert routes and dashboard.
**Complete when:** review survives reload and cannot update another tenant's alert; unavailable storage is an error rather than false success. Source: F10.

### JOB-01: Make asynchronous acceptance durable

- [x] Persist a uniquely identified job before acknowledging acceptance; remove any inappropriate hardcoded job IDs.
- [x] Ensure exactly one HTTP response path; return 202 for genuinely accepted background work.
- [x] Define explicit job, validation and callback-delivery states rather than marking failed delivery completed.
- [x] Add bounded retry/backoff, stuck-job recovery and an operator path for exhausted failures.
- [x] Retire the legacy error workflow deliberately; independent health probes detect primary-DB failure and the stateful notification path exercises failure/recovery without depending on that DB.

**Where:** async branch, async_validation_jobs schema, background workflow and error handling.
**Complete when:** insertion failure never produces a false acceptance; accepted jobs survive interruption/retry; failed callbacks remain identifiable and recoverable without duplicate execution. Source: F11.

## Workstream 6 — Deployment, operations and measured capacity

### OPS-01: Verify database and secret controls

- [x] Review actual key/request/event uniqueness, foreign keys, quota constraints and user/time indexes; inspect representative query plans.
- [x] Verify least-privilege DB roles, TLS, pooling/connection limits and applicable tenant defense-in-depth controls.
- [x] Confirm staging/production secret separation, credential access/rotation and sanitized execution logs.
- [x] Review current Git history for exposed secrets; commit the existing local .clerk ignore protection deliberately after review.

Evidence: [production inspection](operations/production-inspection-2026-11-01.md), [current acceptance](operations/launch-acceptance-2026-11-03.md), and [closure](operations/launch-closure-2026-11-03.md).

**Complete when:** live configuration is documented and tested; no secret values are placed in the report/repository. Do not add indexes/RLS blindly without inspecting the current schema. Source: scalability section, F09, F12.

### OPS-02: Decouple public pages from dashboard authentication

- [x] Move dashboard provisioning/blocking auth behavior out of public routes while preserving protected-route behavior.
- [x] Keep public marketing/docs/status content renderable without waiting for identity initialization.

**Where:** root layout, AuthContext/provider placement and dashboard boundary.
**Complete when:** generated public HTML includes its main content; status/public pages remain useful during identity-client failure; sign-in and protected dashboard access still work. Source: F12.

### OPS-03: Establish CI and recovery procedures

- [x] Fix the recorded lint error/warnings and add CI for meaningful lint, build, tests and dependency checks.
- [x] Document environment setup, architecture, migration/deployment order and rollback in the README/runbooks.
- [x] Verify backup schedules, restore a backup into staging, and test migration rollback/recovery.
- [ ] Complete an authenticated offsite backup and separate protected recovery-key custody after the approved storage quota issue is resolved.
- [x] Provide operator error/incident alerts and practical recovery for backend/model/payment failures; verify alerting independently of the failing DB where feasible.

**Complete when:** checks gate changes, a restore drill succeeds, and another operator can follow the runbook. Existing visitor-triggered health checks must not be advertised as continuous uptime monitoring. Source: F11, F12 and release criteria.

### OPS-04: Measure capacity and validation quality

- [x] Create a labeled judge evaluation set with safe/unsafe examples, malformed responses and prompt-injection attempts; measure false passes and false blocks.
- [x] Test action-specific structural/policy behavior actually promised to customers and document the limits of ungrounded semantic judgments.
- [x] Run staging burst/soak tests with representative payloads, token sizes, callbacks and retries.
- [x] Record bounded local mock-soak throughput/latency/quota behavior and native synthetic judge results with their limits.
- [ ] Collect representative cloud beta queue/connection/provider-token/cost and latency/error observations.
- [x] Set explicit request/token/concurrency/admission limits, timeouts and stateful alerts.
- [ ] Owner verifies provider monetary spend/recharge settings and reviews a budget against measured beta usage.

**Complete when:** the supported launch workload and failure behavior have measured evidence; no customer-count, accuracy or SLA promise is based only on monthly quota arithmetic. Source: scalability section and release criteria.

## Later: growth and enterprise work

These are conditional expansion tasks, not instructions to buy or deploy more infrastructure tomorrow.

- [ ] Consider shared queue/worker capacity or a dedicated stateless validation API when measured load/recovery requirements justify it.
- [ ] Separate validation, callback delivery and control-plane workloads as needed; size DB/model concurrency together.
- [ ] Add team/workspace roles, access auditability and any required SSO only when the product actually supports those use cases.
- [ ] Verify availability/failover, governance, licensing, data commitments and operational support before selling enterprise contracts or SLAs.

**Complete when:** demand and contract requirements justify each addition and it has been tested. No Kubernetes, multi-region system or paid monitoring product is a prerequisite for fixing the existing MVP launch gates.

## Original first-session plan: 20 October 2026 (historical)

Recommended order, not a promise that every task will fit in one day:

1. BASE-01 and BASE-02: current exports/configuration, safe staging and recovery baseline.
2. Start SEC-01 dependency patching and validate the current parser/URL behavior.
3. Close SEC-02 and SEC-03 against the current workflows; resolve BASE-03 execution semantics before callback changes.
4. Continue with callback safety, authentication boundaries, quotas and payment idempotency.
5. Work through privacy, dashboard correctness, background recovery and release verification in the following sessions.

Inputs needed from the live environment: current workflow exports; schema/quota-function definitions; configuration confirmation for Railway/Vercel/Clerk/Razorpay; staging/sandbox access where necessary. Never paste secret values into chat. Provide updated exports as evidence before modifying the workflows; previous instructions to leave the supplied JSON files unchanged remain in effect unless you authorize edits.

## Final launch gate

Do not mark launch-ready merely because tasks are implemented. Record evidence for each requirement:

- [ ] All critical/high launch findings fixed or verified absent, with current deployed revisions and any justified release exceptions documented.
- [x] Two-account isolation and session-switching tests pass.
- [x] Model output cannot alter identity, destination or signing context; malformed/model-error paths fail safely.
- [x] Callback tampering/replay, duplicate execution and unsafe destinations are prevented under the chosen contract.
- [x] Concurrent usage and payment retries cannot exceed quota, double-create a subscription or refill the same paid period.
- [x] Standard log retention, deletion guards and backup-source rotation are implemented/tested; recovery-ledger gate and held-copy exceptions are documented.
- [ ] Verify external provider retention and held/offsite-copy custody before wider release.
- [x] Real logs/review/statistics, examples and plan contracts have acceptance coverage.
- [ ] Deploy this follow-up pagination/auth/recovery release and verify the canonical site; complete external policy review.
- [x] Build/lint/tests, sandbox payment flows, staging load/quality tests and backup restoration pass.
- [x] Operator alerting, rollback, payment reconciliation and support recovery are documented and exercised.
- [ ] Controlled beta observations support the intended wider launch limits.

Finishing these tasks supports an evidence-based launch decision. It cannot guarantee perfect security, a permanent 10/10 score or enterprise compliance. Reassess the deployed system and residual risks at the end.

## Traceability to the report

| Finding                                | Checklist items                                                |
| -------------------------------------- | -------------------------------------------------------------- |
| F01 Dependencies                       | SEC-01                                                         |
| F02 Trusted judge context              | SEC-02, AUTH-02                                                |
| F03 Callback destination protection    | SEC-03                                                         |
| F04 Execution/callback contract        | BASE-03, SEC-04, DATA-01                                       |
| F05 Quotas                             | QUOTA-01, BASE-01/02                                           |
| F06 Abuse/spend                        | API-01                                                         |
| F07 Privacy                            | PRIV-01, PRIV-02                                               |
| F08 Payment concurrency/reconciliation | BILL-01, BILL-02                                               |
| F09 Keys/dashboard identity            | AUTH-01, AUTH-02, OPS-01                                       |
| F10 Logs/alerts                        | DATA-01, DATA-02                                               |
| F11 Durable background work            | JOB-01, OPS-03                                                 |
| F12 Hardening/engineering/claims       | API-02, PRIV-02, OPS-02, OPS-03                                |
| Scalability and release criteria       | OPS-01, OPS-04, final launch gate and conditional growth tasks |
