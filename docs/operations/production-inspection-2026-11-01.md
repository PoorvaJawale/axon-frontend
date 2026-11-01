# Production inspection and cutover gates — 1 November 2026

Selected project: **spectacular-enthusiasm**, production environment. Initial read-only observations are recorded below. Subsequent authorized production changes are recorded in the final section; the initial observations are not the current deployment state.

**Latest state, 1 November:** public frontend/workflow cutover is complete; the main URL points to the verified release. Main n8n and its private runner are digest-pinned; both application and live n8n metadata databases are PostgreSQL 18.6 using restricted logins and verified TLS. Four hardened workflows are active. See the final section for current evidence and remaining external acceptance gaps; earlier sections are chronological records.

## Initial live setup before changes

| Component | Observation | Required treatment |
|---|---|---|
| Axon application DB | PostgreSQL 18.6; six public application tables; 13 initialized quota accounts | All five candidate migrations passed against an offline production-data restore on 18.6. Preserve the original account/key records. |
| DB privileges | Only postgres superuser login | Add separate web/validator logins with reviewed group grants; avoid owner credentials in the frontend. |
| Application DB TLS | Enabled; certificate SAN is localhost only, signed by its private root CA | Issue a correctly scoped server certificate for the verified private/public hosts and configure CA verification. Do not disable certificate checks. |
| Application DB host | Public tokaido.proxy.rlwy.net:58700; private postgres-k-cw.railway.internal | Use private routing for in-project connections and verified TLS for the Vercel connection. Never commit the connection credentials. |
| n8n | 2.43.6, matching local tests; 12 active legacy workflows | Controlled endpoint/credential cutover; keep health functional. Disable retired admin/reset workflows only when replacement paths are ready. |
| n8n runtime | Default runner mode, crypto-only builtin setting, Code environment access unblocked, no explicit execution concurrency/retention settings | Prepared private external-runner candidate; block environment access, restrict modules and bound/save/prune appropriately. |
| n8n metadata DB | Separate PostgreSQL 16.15; public-proxy host; TLS settings unset | Verify actual transport, move to private routing and authenticated TLS. CLI warned PG16 is compatibility-only for this n8n version; plan and stage the supported-version upgrade separately. |
| Backups | No snapshots/schedules listed for three volumes; app PITR off | Native snapshot creation was rejected as Pro-workspace-only. No plan upgrade was made. Encrypted logical recovery copies now exist locally; automatic/offsite backup operations still need a configured, tested path. |

## Recovery evidence

After an explicit user approval for the data/destination and offline restore, AES-256-GCM backups were created for the application DB, n8n metadata DB and n8n encryption key. Backup artifacts are under ignored `.cache/production-backups` on D:, with the separate backup key under ignored `.cache/recovery-keys`. Both locations must be preserved securely; neither belongs in GitHub or chat. Integrity tests reject altered headers/ciphertext/tags and wrong keys before restore.

The application copy was restored into **axon-offline-recovery-postgres18**, which has Docker network mode **none**, no published ports and storage under `.cache/recovery/postgres18` on D:. It contains real production recovery data under the user's explicit approval. No workflow points at it. It must not be exposed publicly or mixed into the synthetic staging service.

The restore contained **13 accounts, 25 keys and 72 logs**. All five additive migrations and group grants passed on PostgreSQL 18.6. Before/after digests of every existing quota/key row and log count were unchanged; web could not update Free counters, and validator could not execute billing. Original production functions/rows were not replaced. The n8n metadata/key artifacts were authenticated but were not restored, consistent with the approved scope.

These are point-in-time local recovery copies, not a claim of automated, offsite or fully rehearsed n8n/project recovery. TLS private keys and a full provider configuration backup are not included; document reissuance/configuration steps for a replacement host.

## Deployment sequence to complete

1. Preserve current backup references and compare fresh live counters immediately before applying changes. Never reset lifetime Free usage or rewrite existing paid commitments as part of migration.
2. Stage/test TLS certificate identity and trust for the real hostnames; preserve an immediately usable old-certificate rollback. Inspect pending PostgreSQL config changes before a reload. Plan metadata-DB TLS/version work explicitly rather than blindly upgrading a live volume.
3. Apply the reviewed additive migrations and least-privilege logins. Keep production credentials out of tracked files, output and test fixtures. Verify the actual login identities/permissions over verified TLS.
4. Get resource approval before adding the private external runner. Prepare its native credentials and main-service settings together, then test readiness before routing validation traffic.
5. Configure Vercel's new server-only DB URL/CA and actual provider settings before publishing the matching frontend. Existing Git auto-deployment must not receive this build without its database/role setup. Vercel CLI access is now verified; the existing `axon-frontend-vxa8` project uses Next.js and Node 24.x. Environment names were inspected without retrieving secret values: `AXON_DATABASE_URL` and `AXON_DATABASE_CA` are absent. Existing Clerk, Razorpay, SMTP and health-check variable names are present, which does not verify their values or provider configuration.
6. Import/bind the three hardened candidates, preserve the validation path, retire legacy admin/monthly-reset paths and verify health. Keep old versions and rollback commands ready.
7. Complete actual provider webhook delivery, deployed auth/CSP/two-account cache isolation, capacity and independent outage notification checks. The local 12-case real-model result is a smoke check, not a production safety/error-rate guarantee.

Public frontend/workflow cutover has **not** been performed. The private runner was subsequently approved and provisioned as described below; no paid plan upgrade or bucket was created.

## Vercel access verification

The owner completed CLI login. The selected project is `axon-frontend-vxa8` (`prj_pSnqPKuy3m01ky2JB3x7LDCIUctT`) under `poorvajawales-projects`; a second project named `axon-frontend` also exists and must not be confused with it. The account alias inventory includes `axon-frontend-vxa8.vercel.app`. The CLI's reduced project-inspection response did not include Git linkage/production-branch fields, so those were not verified. Existing environment secret values were not downloaded. Keep CLI authentication under ignored D: storage.

## Authorized production changes and verification

- The owner approved the metered private runner. Service `axon-private-runner` (`970f28e8-1146-4cca-87fa-c69548f86b15`) was created without a public domain. Its launcher health returned 200 and it registered with the n8n broker. Resource use is billable within the existing plan.
- A replacement app DB certificate was issued using the existing on-server CA/key, with SANs for the public proxy, private database hostname and localhost. The old leaf certificate is retained as `server.before-axon-hostnames.crt`. A PostgreSQL reload activated it; a fresh handshake verified chain/hostname. Private TLS keys stayed on Railway.
- A fresh encrypted application backup preceded the five additive migrations and grants, applied in one transaction with bounded locks/statements. Assertions preserved all existing quota/key rows and log count: 13 accounts, 25 keys, 72 logs. No existing plan allowance or usage was reset.
- Separate `axon_control` and `axon_validation` logins were created with restricted groups, no administration privileges and connection caps. Both connected through the public proxy with authenticated TLS 1.3; web cannot update lifetime Free usage, validator cannot apply billing. New login recovery secrets remain in ignored D: storage.
- Automatic approval review required explicit destination-specific consent before credential transfers. The owner explicitly approved the new web URL/password and public CA as server-only Production settings in the existing Vercel project, and separately approved the validator password as an encrypted credential in existing Railway n8n. Both transfers completed; existing Clerk/Razorpay secrets were not downloaded or changed.
- Three production candidates were imported inactive with the restricted native Postgres credential and the existing native OpenAI credential. IDs: `axonProdValidation1`, `axonProdWorker1`, `axonProdStatus1`. Legacy workflow publication is unchanged. Code environment access remains enabled for compatibility until legacy admin/reset routes are retired; this hardening gate is not complete.

### Unexpected version change and correction

The CLI redeploy intended to reuse the current deployment rebuilt the existing floating `n8nio/n8n:latest` source and started **2.45.7**, rather than retaining inspected 2.43.6. Startup applied n8n metadata migrations. All 12 legacy active workflows, the three inactive candidates and credential records were confirmed present afterward. No blind database downgrade/restore was attempted.

The main source was then changed from the floating Git Dockerfile to the official exact image `n8nio/n8n:2.45.7@sha256:9a8d8dcea75667496695d7810d7e1fe018a65efb36cc499d347f3931b3957b5d`. The matching runner uses `n8nio/runners:2.45.7@sha256:2f07088829b6a1df2b6a84746bb8b32c1eaef270315fb5466aa01b1045e9b300`. Local staging is pinned to the same digests. The dedicated n8n volume was assigned to UID 1000; process inspection confirmed `tini` and `n8n` run as `node` (Railway SSH helper commands themselves run as root).

All 15 synthetic local pipeline checks passed again on 2.45.7, without model/payment calls; mock workflows were unpublished afterward. A temporary random-path production probe passed actual external Code execution, allowed-module checks, filesystem-module denial and the native restricted Postgres credential over TLS. The probe was unpublished and n8n restarted to unload it. Full automated suite: **67 passed**. The earlier 12-case real-model smoke was on 2.43.6 and was not repeated; neither result establishes production accuracy/capacity.

### Frontend candidate and remaining cutover gates

An explicit source-only release package (105 files, no environment/backup/recovery files) passed Vercel upload dry-run and built successfully as Production candidate `dpl_dTwLeCKEvf3spdSP6QTJM2AzqzL3`, with `--skip-domain`. Candidate: https://axon-frontend-vxa8-6td52s45u-poorvajawales-projects.vercel.app. The main public domain has not been promoted. Vercel protection redirects automated candidate requests to its access screen; this is not an application authorization result. The owner was asked to sign in and check Overview/Billing without paying. This temporary URL is a Vercel candidate for the existing project, not a replacement public address.

Remaining: candidate signed-in/deployed checks; coordinated hardened workflow publication/legacy endpoint retirement and environment/payload retention hardening; public provider webhook delivery; metadata DB TLS/version planning; automated/offsite recovery; two-account browser/cache, capacity and billing lifecycle checks; missing business postal address. New runtime pinning does not close those release gates. Updated operator receipts are under ignored `.cache/production-deployment`.

The owner then reported an origin rejection on the temporary candidate URL. The canonical-only mutation origin policy was extended to accept the exact server-provided VERCEL_URL under Vercel system context, retaining rejection of foreign projects, forged Host/Forwarded headers, cross-site requests and absent production Origin headers. Two focused security regression tests passed along with the account-route test; lint/typecheck passed and the full suite passed **69/69**. Corrected candidate `dpl_9XqoNkRMuAbkpP8EJub6MaiV1nMM` built READY at https://axon-frontend-vxa8-44h12eddl-poorvajawales-projects.vercel.app with --skip-domain; Vercel's built-in verification reported HTTP 200. Signed-in browser acceptance is still required. The canonical website address is unchanged. The app DB certificate expires 1 November 2027; renewal monitoring/operations must be configured before expiry.

### Signed-in screenshot findings and provisioning fix

Owner screenshots of the corrected candidate showed Pro/5,000 usage on Billing and existing tenant logs/alerts/keys loading, but a shared Send JSON content banner and an unavailable sidebar counter. Automatic AuthContext provisioning sent a bodyless POST without a JSON content type; a forwarded empty stream could reach the route's JSON-only reader. The client now explicitly sends `{}` as JSON. The server also accepts truly empty streams without a content type while continuing to reject nonempty untyped/non-JSON bodies and malformed JSON. Existing valid keys are reused; this fix does not create replacement keys or reset usage.

Sidebar usage is now enabled by sign-in rather than successful API-key provisioning, matching account-level usage authorization and the shared user-scoped cache. The documentation example's retired n8n-production-a160e host was replaced with the inspected axon-n8n-production-1512 service. Overview's zero last-24-hour count alongside historical August logs is expected. Legacy missing agent labels are displayed as Not recorded rather than invented metadata.

Two new provisioning regression tests cover bodyless/proxy-empty/JSON requests reusing the existing key, with no insert, and non-JSON/malformed-body rejection. Targeted lint/typecheck passed; full suite **71 passed**. New source-only candidate `dpl_DGTL7MF7F9q46RVWYi99YxbwacUN` built READY with --skip-domain at https://axon-frontend-vxa8-qqtx3dr9u-poorvajawales-projects.vercel.app. Main-domain inspection confirmed it still points to previous deployment `dpl_F3CNfEQaanzjgBiBXiFdiLaARvj9`. Existing workflow publication remains unchanged; signed-in browser confirmation of the repaired setup remains required.

## Completed live cutover and subsequent checks

The owner confirmed the repaired candidate's banner disappeared and sidebar usage loaded, and chose the Axon email as the public contact. Terms identify Poorva Kiran Jawale as the individual operator in India. No postal address was invented; legal review is not certified.

After fresh authenticated encrypted backups, the owner explicitly approved removal of 72 validation logs older than Free 7-day / Pro 30-day retention and 33 old n8n execution records eligible for seven-day pruning. The background maintenance path was activated and application history was verified empty afterward; account/key/usage data was not reset. A later aggregate showed 13 accounts and 26 keys (ongoing legitimate key creation can change this total), zero logs and zero live smoke fixture accounts. The migration's earlier 25-key preservation assertion applies to its transaction, not a permanent account/key-count freeze. n8n pruning is enabled; do not infer that all old execution payloads disappeared synchronously without checking its prune cycle.

Exactly four workflows are published: `axonProdValidation1`, `axonProdWorker1`, `axonProdStatus1` and native `Axon Health`. Eleven legacy workflows were unpublished, including the old admin/reset and error paths. Health now uses the restricted native database credential. Code environment access is blocked; production concurrency is 5, model/runner concurrency is bounded, input size is 1 MB at n8n ingress with stricter application limits, execution timeout is 120 seconds, and success/error/manual payload saving is disabled with pruning enabled. Native health and independent monitoring replace reliance on a DB-dependent legacy error workflow.

Three actual synthetic GPT-4o mini verdicts passed through production: synchronous safe PASS, unsafe BLOCK and durable async completion/status. Invalid key/schema and explicit skip checks passed; retry did not double-reserve; usage was exactly three verdicts. The generated account/key/job/log fixtures were removed. No callback, real payment or customer-account mutation was part of this test. These are smoke observations, not an accuracy rate or safety certification.

Vercel build `dpl_76FYCfgDJtiGDXST9vhXsyNLTENj` was promoted, and main-domain inspection confirmed `axon-frontend-vxa8.vercel.app` resolves to that revision. Its health URL points to the inspected active backend. Live checks returned web health 200/no-store, signed-out usage 401/private-no-store, foreign-origin mutation 403, and public status reported website/backend/database operational. The latest full automated suite passed **72/72**; full lint/typecheck passed and production dependency audit found zero advisories at the check time.

### Metadata PostgreSQL 18 replacement

The owner explicitly approved offline metadata restore, the private replacement/resource cost and, after automatic review required a separate destination-specific consent, the new password transfer/live n8n switch. An authenticated metadata backup restored into the existing network-none local PostgreSQL 18.6 container. n8n 2.45.7 CLI read its 17 workflows, four active workflows and five encrypted credentials; this offline check did not decrypt provider credentials or execute workflows.

Private replacement `axon-n8n-metadata18` (`af53601a-765e-4d4e-b855-641f803d757c`) uses a persistent volume and the exact PostgreSQL 18 image already verified in the project. No public domain was added. The authenticated backup was streamed directly over SSH into a verified-empty target with a single-transaction restore; no plaintext dump file was written. A fresh certificate verifies its private hostname. n8n now connects privately as non-superuser `axon_n8n`; two live TLS sessions and four active workflows were observed on PostgreSQL 18.6. Its original encryption key is unchanged and native health credential decryption still works, as demonstrated by operational health.

The old PostgreSQL 16 service was pinned to its exact old image. It had zero clients; its compute was stopped after verification. Service configuration and the persistent volume remain intact for rollback (volume storage can still be billed). The backup helper's n8ndb target now points to the live PostgreSQL 18 service; n8ndb16 is an explicit retired-database selector.

### Capacity and recovery status

A local mock-model burst ran 60 requests across three synthetic tenants with eight concurrent clients and 8 KB payloads: 59 admitted, one rate-limited, five duplicate retries rejected and exactly 59 counted verdicts. Duration 7.188 s; p50 671 ms, p95 1,203 ms, p99 1,613 ms. Initial runs incorrectly started after general health became ready but before webhooks loaded (404s); the test now waits for the real guard. This short local burst does not measure cloud/provider throughput, sustained load or an SLA. Fixtures were removed and mock workflows unpublished.

Daily encrypted local backups are configured for 04:00 IST in Codex, with failure-only notifications; availability depends on the local computer/app. The owner explicitly approved uploading encrypted DB/metadata/master-key backup artifacts and checksums to a newly created private Drive folder; permission inspection showed owner-only access. **The upload failed with storageQuotaExceeded; no offsite upload succeeded.** The separate decryption key was excluded from the prepared archive. Free Drive capacity or another approved private destination is needed; a separate protected recovery-key copy is also still needed for disk-loss recovery.

The GitHub monitoring workflow now defaults to public web health plus recent sanitized public status, so it requires no production provider/database/health secret. It detects stale/unknown/degraded/failing states; actual GitHub installation/run/notification evidence is recorded separately once the source is pushed. It cannot distinguish backend state during a complete frontend outage, although the independent job still detects the web failure.

Remaining release evidence: real external Razorpay webhook delivery and future lifecycle transitions; two-account browser/session-switch checks; longer representative/provider-aware load/beta observations; offsite backup upload and separate recovery-key safekeeping; verified notification delivery and appropriate policy/provider review. These cannot be truthfully replaced by a perfect-score claim.

### Further verification updates

A read-only prebuild check ran inside Vercel without exporting existing provider secrets. Razorpay reported **Live mode, monthly interval 1, INR 79,900 paise**. It created no plan, subscription or payment. A guarded provider preflight now rejects mismatched prices and Test credentials in Production builds; unconfigured local/CI builds skip it. Regression coverage checks correct pricing, mismatch/provider failure, secret-safe logging and environment behavior.

The owner confirmed an enabled Live webhook targets the existing main-domain Razorpay route and its most recent delivery showed **Successful / HTTP 200**. This is owner-reported provider-console evidence, not a newly replayed event or a future renewal/cancellation test. No new live payment was requested.

The owner reported a conflicting validate-path activation message. Inspection found exactly one POST /validate registration, belonging to active axonProdValidation1; an empty request returned the expected structured 400 without a model call. A second copy must remain inactive; the working production path was not changed.

Fresh post-upgrade application and metadata backups were restored again into separate offline PostgreSQL 18 databases. NOLOGIN role placeholders now preserve dump ownership/ACLs without copying runtime passwords. Application restore retained 13 accounts, 26 keys and zero logs unchanged, with migrations/role boundaries passing. Metadata restore retained 17 workflows/four active/five encrypted credentials and passed n8n CLI compatibility. Native credential decryption was verified through live health, not by exporting plaintext provider keys into the recovery test.
