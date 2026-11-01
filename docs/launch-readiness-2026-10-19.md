# Axon: architecture, security and launch-readiness review

**Date:** 19 October 2026, Asia/Kolkata. **Frontend revision:** 74cade01f20efb3c15ff75bcd3e463d7d1331ed6.

## Recommendation

Keep the current stack, close the critical gates below, then run a controlled private beta before a broad paid launch. Enterprise readiness is not established. This is an MVP with useful foundations, rather than an audited, highly available guardrails platform.

A green build or health check does not establish safe AI decisions, tenant isolation, billing correctness or privacy compliance. No application code or workflow JSON was changed for this review.

## Scope and confidence

Reviewed the repository's routes, authentication, server libraries, dashboard, claims, dependencies, configuration and tests, plus twelve supplied n8n exports. Eleven original backend files are dated 27 August 2026; Axon Health.json is dated 19 October. You have since edited live workflows, so export-only findings must be verified against fresh production exports rather than assumed still deployed.

Also checked a handful of ordinary anonymous public GETs, current dependency advisories, and official provider documentation. Selected workflow JavaScript was tested offline with synthetic data. No production payments, DB writes, network exploit probes or load tests were performed.

Not inspected: live DB schema/functions/indexes/RLS/grants/TLS/backups; Railway replica/queue/worker settings and n8n version; instance execution retention; Clerk production settings; Vercel firewall; Razorpay dashboard configuration; secret history or backup restoration. Missing repository evidence does not prove a live control is absent.

The deployed health endpoint currently works even though its local export is inactive and incorrectly wired, demonstrating that live configuration differs from the supplied files.

## Architecture today

~~~mermaid
flowchart LR
  Browser[Dashboard browser] --> Next[Next.js on Vercel]
  Next --> Clerk[Clerk identity / private metadata]
  Next --> N8N[n8n on Railway]
  Next --> Razorpay[Razorpay subscriptions]
  Razorpay -->|Signed events| Next
  Agent[Customer server / AI agent] -->|Bearer key| N8N
  N8N --> DB[(PostgreSQL)]
  N8N --> Judge[OpenAI GPT-4o-mini]
  N8N --> Callback[Customer execution endpoint]
~~~

**Control plane:** Clerk sessions identify dashboard users. Next.js server routes proxy management and data requests. Dashboard reads reuse a customer API key stored in Clerk private metadata. Billing/key administrative operations use a shared server-side signup secret. Entitlements are written through n8n to PostgreSQL and separately to Clerk.

**Data plane, as exported:** customer servers call the n8n validate webhook directly. Input checks precede key lookup and quota checks, then routing to synchronous structural/model checks, asynchronous chat validation, or an internal-reasoning skip. Sync validation can make three model attempts. Logs are stored and results/payloads forwarded to a caller-specified endpoint.

This is a managed-service SaaS MVP with a workflow backend. It is not evidence of a microservice fleet, multi-region failover or worker autoscaling. A non-blocking sub-workflow is not proof of a durable distributed queue.

## Existing strengths

| Control | Evidence | Limit |
| --- | --- | --- |
| Session checks | Sensitive server routes call Clerk auth; middleware protects dashboard/control routes | Actual provider settings and tenant isolation still need testing |
| Ownership checks | Key revocation derives the user ID from Clerk; supplied SQL filters owner and key; subscriptions require matching owner notes | Backend service credentials/queries remain trust boundaries |
| API secret generation | Supplied workflow generates 24 random bytes and stores SHA-256 hashes in PostgreSQL | Latest raw key is also retained in Clerk private metadata |
| Payment verification | Raw-body HMAC and timing-safe comparison; checkout signatures; provider-fetched subscription, price and paid-period checks | These do not make business transitions idempotent |
| Parameterized SQL | Reviewed key lookup, tenant reads and management updates use parameters | SQL parameters do not protect callbacks or model output |
| Safer rendering | No dangerous HTML sinks or persistent browser-secret storage found in current tracked-source scan; SMTP HTML is escaped | This is not a complete XSS or secret audit |
| Health checks | Timeouts, request nonces, cached results and stale/failure states implemented | Visitor-triggered checks do not exercise validation, judge or payments |
| Tests | 44 existing payment/status tests pass | Mock-based; not deployed workflow or tenant-isolation tests |

## Priority findings

Severity is release priority. For export-only findings, fix the behavior or prove it is absent from current production through fresh exports and regression tests.

### F01 — Critical gate: affected dependencies

**Current checkout / current registry audit.** Next.js is pinned to 16.2.7 and Nodemailer resolves to 9.0.3. npm audit --omit=dev reports seven affected package entries: one critical, five high and one moderate. Entries include next, nodemailer, sharp, postcss, nanoid, source-map-js and baseline-browser-mapping.

These are advisory matches, not seven demonstrated exploits. Exposure varies: some findings require Windows hosting, particular image processing, server actions, custom rewrites or build-time input. Next.js 16.2.7 is explicitly within the affected range of the maintainer's middleware/proxy bypass advisory.

**Action:** upgrade to maintained patched versions, update compatible tooling and lockfile, review relevant Next.js changes, rebuild, and test identity/payment/image/status flows. The audit proposes Next.js 16.4.2 as a fix candidate; that version was not installed or compatibility-tested here. Do not blindly force-upgrade. [Next.js maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24).

### F02 — Critical gate: model output can overwrite trusted context

**Older exports; reproduced offline.** validationproject → Code in JavaScript11 and Background Semantic Validator → Parse Judge1 return an object equivalent to { ...src, ...parsed, judge_raw: content }.

A valid JSON model response can therefore replace user_id, body, request_id and webhook_secret. An offline synthetic response demonstrated all four replacements. The background callback URL is then read from the replaced body, potentially bypassing the earlier URL guard. This proves an unsafe parser merge, not a successful real-world prompt injection against production.

**Action:** schema-validate judge output and explicitly copy only verdict, risk, confidence, category and a bounded reason into a separate judge object. Reject unexpected fields. Preserve authenticated tenant identity, request ID, destination and signing secret as immutable trusted context. Test malicious extra fields independently of model behavior.

### F03 — Critical gate: callback SSRF / egress protection

**Older export; offline tests.** Callers supply execution_endpoint for outbound POSTs. The guard uses string parsing and checks common private-address spellings. It accepts shortened/numeric loopback forms in offline tests. No live connections to those addresses were made. It does not establish safe DNS resolution, address binding, comprehensive reserved-network handling or redirect validation. HTTP is allowed; outbound node options do not show explicit timeout/redirect limits.

**Action:** preregister and verify tenant HTTPS callback destinations, use a real URL parser, validate and bind the connection to permitted resolved addresses, restrict egress to private/reserved networks, disable or revalidate redirects, and cap time/body sizes. A verdict-only API avoids automatic forwarding risk if that product contract is intentionally chosen and documented. [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

### F04 — High gate: execution and callback contract

**Current example plus older exports.** The landing-page code calls execute(agentOutput) after PASS, while the exported workflow already POSTs to execution_endpoint. That creates potential double execution for integrations following both behaviors. The example omits required agent_id and uses api.axon.dev, while docs and server code reference different Railway hosts; ownership/availability of the example domain was not verified.

Sync callbacks have no signature headers. Background callbacks sign JSON.stringify(src) but transmit a different constructed body, so receivers cannot verify the MAC against received bytes in the usual way. Missing secrets fall back to a constant. No timestamp/replay/idempotency contract or durable delivery retry is established. BLOCK content is also POSTed to the execution destination as an alert. Callback failures can continue to a PASS response; validation success and delivery success are not distinguished.

**Action:** choose validate-only or validate-and-dispatch semantics. Sign exact outgoing bytes with a tenant secret and timestamp/event ID, fail on missing secrets, require receiver idempotency, separate alert/execution event types or destinations, and distinguish verdict/delivery/execution statuses. Publish tested examples using the verified production URL.

### F05 — High gate: atomic quotas and billing periods

**Older exports; newer live migration not supplied.** The old validator checks usage then increments a per-key counter separately, permitting concurrent quota overshoot. Incrementing before results can charge failed/skipped work. The old reset clears Free counters, and key creation still assigns 1,000 Free / 50,000 Pro, conflicting with current 100 lifetime Free / 5,000 paid-period Pro terms.

You already worked on account quotas in production, so these observations must be rechecked against fresh workflow exports and actual DB functions.

**Action:** prove an atomic account-level check/reservation, unique request identity, correct reservation finalization/release, lifetime Free preservation across keys/plan changes, and paid-period Pro resets exactly once. Test parallel near-limit requests, multiple keys, retries and upgrades/downgrades. Version the schema/functions and reviewed migration history.

### F06 — High gate: abuse and spend controls

**Current routes / older workflow.** No application-side distributed rate limiter was found for validation, key creation, subscription creation or the public SMTP form. A monthly allowance is not a per-second throttle. The 1 MiB validator body check occurs after parsing; tighter per-field/model token budgets are not shown. Model failures can cause three immediate attempts. The exported Free path also reaches the semantic judge, while pricing only lists schema validation for Free. External firewall controls were not inspected.

**Action:** enforce per-key/account/IP burst limits, active-job caps, fair tenant concurrency, payload/field/token limits, bounded retry/backoff and global spending safeguards before model calls. Validate/cap contact fields and add spam controls. Verify Clerk signup/email controls and resolve the intended Free feature policy.

### F07 — High gate: retention, deletion and privacy promises

**Current claims / older insert mappings.** validation_logs explicitly stores raw_output.content. Request headers/model inputs are carried through workflow execution data, creating another potentially sensitive store. No implemented retention/deletion mechanism was found in reviewed source/exports. That conflicts with unqualified zero-output-retention messaging and unverified 7/30-day retention promises.

Privacy and Terms footer links point to #. No account-data export/deletion flow or subprocessor/retention policy was found. This is a privacy/product gap, not a legal compliance determination.

OpenAI receives customer content and metadata for semantic checks. Official API documentation says API data is not used for training by default unless sharing is opted into, but abuse-monitoring content can normally be retained for up to 30 days; application-state retention depends on the endpoint/options and account controls. The effective n8n API endpoint/store settings and organization controls were not verified. Do not promise zero provider retention from a basic API account. [Official OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

**Action:** map all data stores/subprocessors, redact secrets/PII, minimize model inputs, implement TTL/deletion jobs, configure n8n execution saving/pruning and staff access, define backup retention, and publish accurate privacy/terms/refund policies. Zero-retention offerings require an actual no-content-storage path and verified provider eligibility/configuration.

### F08 — High gate: payment concurrency and reconciliation

**Current code.** Ownership/price/signature checks are useful, but subscription creation reads an existing ID, creates a subscription, then saves metadata without a durable account lock. Two concurrent requests can both create subscriptions before either saves its ID. Sequential duplicate prevention does not prevent this race.

No durable processed-event ledger, periodic reconciliation or refund/dispute lifecycle is evidenced. Refetching current provider state helps with delayed events, but duplicate activations still reach backend SQL. PostgreSQL and Clerk are separate writes and can diverge if one fails.

**Action:** durable subscription/entitlement records, per-account creation locking, event deduplication, period-transition idempotency, retryable reconciliation and support recovery. Test concurrent creation, reordered/duplicate events, cancellation at period end, payment success with DB failure, and metadata failure after DB success. Verify actual Razorpay mode, webhook events and plan amount.

### F09 — High reliability issue: dashboard tied to a customer key

**Current code.** lib/axon.ts obtains the dashboard backend credential from Clerk privateMetadata.axonApiKey. Revoking/expiring that key can break dashboard usage/logs/alerts/key-list access despite a valid Clerk session. Automatic provisioning short-circuits when a stored key exists without verifying it is active. The exported creation workflow sets a 90-day expiry.

Private metadata is server-side, which is good, but retaining the raw key creates another secret store; the architecture is not hash-only end to end.

**Action:** separate dashboard/control-plane service access from customer integration keys. Minimize raw-secret copies; scope/separate internal administrative permissions and define rotation/recovery. Clear auth state and tenant caches on identity changes. Most dashboard SWR keys are URL-only, while the usage cache is already user-scoped. Test two users and a revoked/expired primary key; no cross-account exploit was demonstrated here.

### F10 — High product-integrity issue: logs and review semantics

**Current code / passive public GETs.** /api/logs and /api/alerts are unauthenticated legacy endpoints returning synthetic 2024 fixtures. This is not evidence of a real customer-data leak, but public demo data is confusing in a live API.

/webhook/logs retrieves only the latest 200 rows, then paginates/filters in Next.js. Statistics are sample counts, not full-account totals; the overview labels them last 24 hours without the corresponding query filter. Every non-PASS row is mapped to BLOCK, so async flags cannot be counted correctly. Pagination inputs need robust bounds.

/webhook/alerts POST returns success without persisting reviewed state. The UI warns when it detects this, but success still does not mean saved. blockedOutput is populated from reason rather than the original output.

**Action:** tenant-scoped DB filtering/pagination/aggregates and time windows, correct async result mapping, persisted review actor/time/status, and removal or isolation of mock endpoints. Test over 200 events, invalid page/limit inputs and two tenants.

### F11 — High reliability gate: durable background acceptance

**Older exports; deployment unknown.** Async job insert, background execution and response are independent branches. The insert hardcodes id=0, which may collide if unique, and continues after errors. Both that branch and another branch lead to Respond Async. Durable job creation is not visibly required before acknowledging work. Callback errors can still lead to COMPLETED.

No retry/backoff/dead-letter/stuck-job recovery is demonstrated. No queue deployment is defined in this repo. Error Handler writes to the same DB; original main workflow settings do not show it attached. DB failure may also impair error reporting.

**Action:** persist acceptance before returning 202, use unique IDs, explicit processing/delivery states, bounded retries and stuck-job recovery. Verify current table constraints/wiring. Ensure operators can see failures when the database or Railway is unavailable.

### F12 — Hardening, public resilience and engineering gaps

- **Headers:** deployed homepage has HSTS but no CSP, framing restriction, nosniff, Referrer-Policy or Permissions-Policy in the observed response. Health endpoints do set nosniff. Add tested headers/CSP compatible with Clerk, Razorpay and Next.js; do not break checkout with a blind policy.
- **Timeouts/input:** axonGet, several key operations, invoices and subscription creation lack explicit timeouts. Validate/bound inputs, normalize errors, and explicitly prevent caching of sensitive authenticated responses.
- **CSRF:** no explicit local origin/CSRF controls were found. Cookie/Clerk behavior may mitigate this; no exploit was demonstrated. Verify those protections and enforce expected origins for browser mutations, keeping provider webhooks signature-based.
- **Public rendering:** root AuthProvider returns null until Clerk loads. Generated home/status HTML contains no h1/main markup; public content depends on client identity initialization. Move dashboard provisioning/blocking gates out of public reading/status routes.
- **Claims:** home/pricing/footer advertise 99.9% uptime, immutable logs, strict custom per-action schemas, a fail-closed three-layer system, Slack/PagerDuty, on-premise/SLA and SOC 2 work without sufficient supporting evidence here. Ordinary DB inserts are not tamper-evident logs; snapshots are not uptime history. Verify each claim or describe it as planned.
- **Delivery:** production build passes, but repo-wide lint finds one error in components/hero.tsx:219 and unused-variable warnings in dashboard/docs and enterprise-contact. No tracked CI or DB migration definitions were found. README remains starter boilerplate.

## Scalability: what can grow and what will bottleneck

Vercel can serve static assets/CDN content and run mostly stateless Next.js handlers across instances. Clerk/Razorpay are managed services. PostgreSQL is a sensible initial system of record. Public auth-gating currently weakens otherwise useful static rendering.

Actual Railway instance counts, queue mode, worker concurrency, DB pooling/failover and model limits were not inspected. No request-rate or p95/p99 benchmarks exist in the reviewed repo. Do not claim a supported user count or availability percentage from the monthly validation allowance.

Likely pressure points: OpenAI latency/rate limits, n8n concurrency/memory, slow callbacks, PostgreSQL connections/queries, and frequent Clerk profile reads. Dashboard polls every 10–15 seconds; each proxy read can cause Clerk → n8n → DB work. Local status caching is useful but is not a global distributed request limit.

**Illustration, not capacity evidence:** 1,000 accounts consuming 5,000 validations each make 5 million requests over 30 days, about 1.93/second on average. A 20x burst is about 39/second. At two seconds per request that implies around 78 in-flight operations before retries/callbacks. Measure request rate multiplied by processing time, not just customer count.

| Stage | Appropriate design | Required evidence |
| --- | --- | --- |
| Hardened beta | Keep existing stack; atomic account quotas; bounded requests/jobs; tenant limits; backups; correct product contract | Tenant-isolation tests, judge evaluation set, payment retry/concurrency tests, restore drill |
| Growing paid service | Durable jobs/outbox, DB indexes/pooling, shared limiter, reconciliation and telemetry | Staging burst/soak tests, cost limits, queue recovery, bounded latency |
| Higher throughput / enterprise | n8n queue workers or a dedicated stateless validation API plus workers; separate validation/delivery/control workloads | Measured failover/recovery, access auditability, verified data handling, contractual support/SLA |

Official n8n queue mode uses Redis and workers. It is a future option, not a verified current deployment; workers also increase DB/model pressure, and multi-main availability has separate feature/licensing constraints. There is no reason to adopt Kubernetes just to close these launch gaps. [n8n queue-mode guidance](https://docs.n8n.io/hosting/scaling/queue-mode/).

Check the live database for unique key-hash/request/event identities, user/time log indexes, account quota constraints, foreign keys, least-privilege roles, TLS, connection limits, query plans and tested restore procedures. No schema files were supplied, so absent indexes/RLS cannot be asserted.

## Authorization and privacy model to establish

Use three separate identities: Clerk human sessions for management; scoped/revocable customer keys for validation; narrowly authorized internal service credentials for dashboard/billing/key operations. Derive tenant identity from authenticated state, never model output or caller-selected owner fields. Parameterized SQL and tenant predicates solve different problems; both need tests. Add team roles only when workspace/team access is actually supported.

| Data | Observed handling | Required control |
| --- | --- | --- |
| User name/email/identity | Clerk plus key table in export | Purpose, access, deletion/retention and provider configuration |
| API secrets | Hash in DB; latest raw key in Clerk private metadata; possible execution records | Minimize copies, independent dashboard access, safe rotation and logging |
| Agent content/metadata | Model input, raw DB logs, external callbacks | Redaction, destination restrictions, subprocessor disclosure, deletion/TTL |
| Payment information | Hosted Razorpay plus subscription/invoice APIs; no local card-number storage found | Keep card entry with provider, reconcile entitlements, support refunds/disputes |
| Execution/errors | n8n records and system_errors table | Staff restrictions, content/secret minimization, deliberate pruning |

No evidence establishes SOC 2 certification, GDPR/DPDP compliance, end-to-end encryption, zero retention by default or enterprise readiness. Managed HTTPS is useful but is not equivalent to those commitments.

## Verification results

| Check | Result |
| --- | --- |
| Production build at reviewed revision | Passed; generated health/status/icon routes |
| Automated tests | 44 passed, payment and status suites |
| Full ESLint | 1 error, 2 warnings across 68 scanned source/config files |
| npm production audit | 7 affected package entries: 1 critical, 5 high, 1 moderate; individual exploitability not proven |
| Current tracked-file secret patterns | No matches; only .env.example tracked; no tracked .clerk files; history not audited |
| Offline parser reproduction | Trusted callback/identity/request/signing fields can be overwritten |
| Offline URL guard | Alternative loopback representations accepted; no network request made |
| Public homepage | HTTP 200; HSTS present, several headers absent |
| Public status | HTTP 200, web/backend/DB operational at 2026-10-19T16:11:10.892Z / 21:41:10 IST; point-in-time only |
| Public legacy demo routes | HTTP 200; 8 synthetic logs / 3 synthetic alerts |
| n8n /healthz | HTTP 200; runtime liveness only |
| Live DB controls, cross-tenant isolation, backups, load capacity | Not verified |

## Launch sequence and acceptance criteria

1. Patch dependencies. Obtain fresh live validator/background/quota/billing exports and reviewed DB schema/functions.
2. Close or verify absence of parser-overwrite, SSRF and unsafe callback behavior. Choose validate-only or dispatch semantics and test complete docs examples.
3. Verify atomic 100 lifetime Free / 5,000 paid-period Pro enforcement with multiple keys, parallel traffic and billing retries.
4. Add subscription creation locking, period/event idempotency and reconciliation. Run sandbox end-to-end payment, cancellation and recovery tests.
5. Prove two staging tenants cannot read/revoke/alter each other's resources; model content cannot rewrite identity or destination.
6. Implement actual retention/deletion and publish accurate privacy/terms/refund/support information. Remove unsupported claims and ambiguous mock endpoints; fix review persistence and statistics.
7. Add CI, rollback/runbooks, verified backup/restore, operator failure alerts and a measured staging load test. Establish latency/cost/error budgets before promising an SLA.

A controlled beta should require every critical gate closed, safe failures for model errors, no duplicate execution or period reset in replay tests, tenant isolation, policy-matching deletion, enforced resource/spend caps, and a successful restore/reconciliation drill. Broader paid release follows measured beta behavior. Enterprise promises require separately verified governance, access controls, contracts and recovery guarantees.

## Source navigation

- middleware.ts; lib/axon.ts; lib/razorpay.ts: authentication, service calls and entitlements.
- app/webhook/create-api-key/route.ts:43/86: provisioning short-circuit and private-metadata raw key.
- app/webhook/razorpay-subscribe/route.ts: read/create/save race; app/webhook/razorpay/route.ts:30: raw-body HMAC/event flow.
- app/context/AuthContext.tsx:89: public rendering blocked on Clerk loading.
- app/webhook/logs/route.ts and app/webhook/alerts/route.ts: sample statistics and nonpersistent review.
- app/webhook/contact-sales/route.ts: public SMTP endpoint; app/api/logs and app/api/alerts: synthetic fixtures.
- components/code-section.tsx, hero.tsx, features.tsx, pricing.tsx, footer.tsx: integration and public claims.
- lib/status-checks.ts and components/public/service-health.tsx: on-demand health behavior.
- tests/billing-payments.test.cjs and tests/service-status.test.cjs: automated coverage.
- Workflow findings reference exact supplied filenames and node names because the code is embedded inside JSON strings.

This is an engineering readiness assessment with limited passive verification, not a penetration-test certification, legal opinion, or guarantee of security.
