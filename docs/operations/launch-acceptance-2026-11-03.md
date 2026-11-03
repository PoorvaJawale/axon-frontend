# Launch operations and acceptance — 3 November 2026

This is the current continuation record for the remaining launch work. Earlier inspection files are chronological and may describe superseded states.

## Account isolation

The dedicated development frontend passed a real installed-Chrome A → sign out → B → sign out → A test. Nine checks confirmed owner-only rendered logs, no other account marker over 60 painted frames after each authenticated view, and cleared protected content on each sign-out. Two synthetic Clerk development users and exact local data fixtures were removed. This verifies the tested browser flow; it is not a claim about every browser/device or a formal penetration test.

Run: `node scripts/staging-browser-isolation.cjs` with isolated tooling installed under `.cache/tools/browser-acceptance` (`@playwright/test` and `@clerk/testing`) and Chrome installed. Dedicated `pk_test_`/`sk_test_` keys and localhost:3101/55432 are required. The helper refuses production keys. No traces, cookies, passwords or bearer tokens are saved; the screenshot contains synthetic data only.

## Judge quality and controlled beta

The original instructions classified 27/32 balanced synthetic examples correctly: zero false passes and five false blocks. A maximum-five-case diagnostic recorded only synthetic rejection reasons. The errors treated hypothetical database risk, accurate corrections, acknowledged uncertainty and security training as violations.

The candidate clarifies concrete harmful action versus benign mention, retaining GPT-4o mini, 300 output tokens, store:false, structured output, the 0.8 confidence threshold, high-risk blocking and fail-closed parsing. It passed the unchanged 32-case set and a separately worded 12-case set, with zero observed false passes/blocks. Results are small hand-labeled samples; they do not estimate production error rates. Refreshed pre-release evidence is saved privately under `.cache/staging`. Original supplied Downloads JSONs were not edited.

A bounded local mock soak previously completed 240 8-KB validations over 142.773 seconds across three tenants/four paced clients, with exact quota accounting and five rejected retries. p50/p95/p99 were 281/779/989 ms. This measures the local mocked path, not provider/cloud capacity.

Current launch controls include 12-KB content, 16-KB validation payload, 300 completion tokens, four active validation slots, at most two per tenant, 60 validation admissions per tenant per minute and a global 10,000 admission-attempt window of 86,400 seconds. The global cap is not a currency budget or a guarantee about provider retries/hosting spend. Keep provider project spend/recharge settings under owner review; do not assume a quota implies a monetary ceiling.

Controlled-beta procedure: onboard a small cohort, review false-block reports without weakening hard gates, and collect admitted/rejected/error counts, async queue age, provider tokens/costs, p50/p95/p99 latency and callback failures daily. Expand traffic only from representative observations. Do not claim a customer capacity, production accuracy percentage or SLA from these synthetic sets.

## Alerts

GitHub Actions independently schedules public service checks twice hourly; dispatch can be delayed. Public Status checks refresh while visible. A separate local Codex heartbeat checks every 15 minutes when available, suppresses repeated unchanged failures, and notifies on new failures/changes/recovery.

The one-time diagnostic notification executed on 2 November. A subsequent real check failure (web unreachable, backend/database unknown) was reported, followed by an operational recovery notification. No outage was created. These exercise the configured notification path but do not prove that an operator read an OS push or email. No email was sent by this acceptance work. Local monitoring depends on the computer/Codex being available; GitHub remains separate.

## Backup lifecycle and deletion requests

The owner explicitly approved guarded source-backup rotation on 2 November. `node scripts/backup-retention.cjs` is dry-run; `--apply` rotates authenticated encrypted source artifacts older than 30 days only under the pinned D: backup folder. It requires a fresh backup and at least three authenticated points per target, keeps the latest three and latest restore-verified point, and checks encrypted hashes and authentication before removing anything. The approved current application deleted zero files. The daily backup heartbeat now runs guarded rotation only after all three new authenticated backups succeed.

The recovery key folder, transfer ZIPs/staging copies, offsite copies and offline restored databases are deliberately excluded. They require separate operator review; do not advertise a universal 30-day erasure guarantee. Review those copies whenever resolving a deletion request or releasing a recovery hold. Before bringing a restored database online, reconcile deletion requests completed after the backup; never restore removed account data into customer access without that review. The privacy operator remains dry-run first and requires the recorded request, exact owner, provider/backup review and drained work before applying deletion.

Offsite upload remains blocked by the approved Drive account's quota. No offsite success is claimed. Do not upload the decryption key alongside the archive or use another account without explicit approval. Keep a separate protected key copy away from D: under the owner's chosen custody.

## Billing lifecycle and support

Automated fixtures cover canonical cancellation, halted/expired/completed states at cycle end, expired active dates, same-period replay, wrong ownership and refund events not inventing quota or causing an unintended provider mutation. Existing sandbox checkout, activation/replay and acknowledged cycle-end cancellation evidence is recorded in the earlier handoff. Future real provider transitions remain observation, not something to force with a live charge.

For paid-but-not-activated cases, use Restore paid subscription against the existing owned subscription; do not initiate another charge. Check canonical provider state and matching period, then retry idempotent reconciliation. For a different/legacy paid plan, preserve existing commitment and review migration individually; do not charge again or overwrite dates merely to make the displayed price match.

Refunds are manual, individually reviewed support decisions. Match authenticated account, payment, invoice and subscription references in Razorpay; check for existing refunds before any financial action. Confirm eligibility and amount with the owner, then issue the approved refund in the provider dashboard and record its reference/status. Do not infer subscription cancellation from a refund alone; confirm renewal status separately. Raw refund/dispute payloads do not grant allowance. For disputes, record the provider deadline and preserve relevant billing/decision evidence under restricted access; use the provider process and the owner's reviewed decision. Do not automatically retry a charge or make an unreviewed refund.

Provider references: [Razorpay refunds](https://razorpay.com/docs/payments/refunds/), [Razorpay disputes](https://razorpay.com/docs/payments/disputes/).

## Privacy/provider controls

Requests disable optional response storage. That is distinct from provider abuse monitoring or approved organization/project retention controls. The public Privacy page now explains this distinction and the standard Free seven-day/Pro thirty-day validation-history windows. Do not describe Axon as zero retention. The owner’s account-specific data-sharing/retention settings and any special provider agreement are not established by store:false or the API key.

Source: [official OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). The page describes default provider retention and exceptions; this does not establish which optional controls the owner's project has enabled.

Policies identify Poorva Kiran Jawale as the individual operator in India with axonapi2026@gmail.com. No company registration, postal address, certification, legal opinion or enterprise SLA was invented. Appropriate external policy review and account-setting confirmation remain owner-dependent.

## Deployment/evidence

The two existing live model-node expressions are updated only through `scripts/production-judge-instructions.cjs`, with recent native evidence, a fresh authenticated metadata backup, on-server workflow rollback exports, guarded native import/publication and a same-image n8n restart. Exact final deployment and CI evidence is appended after verification. Credentials, graphs, keys, quota counters and payment settings are unchanged by that prompt-only operation.

### Verified continuation completion

On 3 November, the owner-approved source-backup rotation ran with zero deletion candidates. The existing daily 04:00 IST local automation now runs guarded rotation only after all three new authenticated backups succeed. Original offline app/metadata restore receipts were reconciled with their encrypted-source metadata so the actual last verified recovery points remain protected.

The exact classifier and dataset hashes were attached to refreshed 32/32 and 12/12 native evaluation reports. All 87 source regression tests passed, as did lint, TypeScript and all 13 generated-workflow checks. The Privacy page passed desktop/mobile rendering checks and the scoped design detector.

The two existing production model expressions were published after a fresh encrypted metadata backup and on-server workflow rollback export. The first restart invocation timed out; the explicit noninteractive JSON restart succeeded without rebuilding the pinned image. Read-only native exports verified both workflows active and both expression fingerprints matching the tested candidate. After restart, public website/backend/database checks were operational and the actual validate endpoint rejected an empty schema with HTTP 400. No validation/model call, payment, credential replacement or quota reset was used for this post-restart probe.

PR #5 contains the source/tooling/privacy changes: https://github.com/PoorvaJawale/axon-frontend/pull/5. Its first full cloud CI and Vercel checks passed; the final evidence/CLI-format update is checked again on its exact head before merge. Live frontend deployment confirmation is recorded in the final handoff after merge rather than assuming a preview changes the canonical domain.

Still external: the approved Drive account is full, so no offsite upload has succeeded; separate recovery-key custody needs an owner-chosen destination. Account-specific provider settings and independent policy review cannot be established from API source. Future real billing-cycle and representative beta observations remain ongoing, with automated lifecycle coverage and an operator procedure already in place.
