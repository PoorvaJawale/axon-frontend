# Local staging

This stack is isolated from Railway and Vercel. It contains no production records or provider credentials. PostgreSQL and n8n bind only to loopback; the local HTTP/unencrypted PostgreSQL configuration is for this machine, never deployment. n8n and its external JavaScript runner are both pinned to the owner's version, 2.43.6. PostgreSQL is pinned to major 17; confirm the actual provider major version before treating this as parity testing.

Commands from the repository root:

```powershell
node scripts/local-staging.cjs prepare
node scripts/local-staging.cjs start
node scripts/local-staging.cjs status
node scripts/local-staging.cjs stop
```

`prepare` generates random local-only secrets and a bootstrap SQL file in ignored `.cache/staging`, then validates Compose without starting Docker. Do not paste or commit these files. Existing generated secrets are preserved. `start` needs Docker Desktop running and adequate disk space; Windows starts are blocked below 5 GB free on C:. Docker images/WSL disk storage are controlled by Docker Desktop and may still use C: even though bind-mounted application data is on D:. The 5 GB guard is a minimum, not a guarantee that an image download fits.

The database initializes once, using the reconstructed schema, inspected quota functions, additive migrations and group grants. It creates separate `axon_staging_web` and `axon_staging_validator` login roles. No owner/account is seeded. It does not reset or reinitialize an existing data directory. Re-running prepare updates the bootstrap file but does not apply it to an initialized database.

Open http://localhost:5688 and create your local owner account. The three top-level hardened workflows have already been imported and their PostgreSQL nodes bound to a generated local-only validator credential. They remain unpublished. The ten reference workflows were not imported. PostgreSQL uses host `postgres`, port 5432, database `axon_staging`, user `axon_staging_validator`; SSL is disabled only on this private local Docker network. Do not bind live Railway credentials.

For repeatable operator checks, run `node scripts/staging-db-check.cjs`. It connects only to loopback port 55432/database axon_staging, generates dummy accounts, tests concurrent quota reservation/refund and restricted roles, and removes only its own dummy accounts. `scripts/prepare-staging-imports.cjs` is an operator helper after exporting local workflow IDs to the ignored `n8n/workflows-current.json`; it creates local credential-bound copies for CLI import. Delete the temporary plaintext credential JSON after import. It does not publish the three candidates.

Initially leave workflows unpublished and OpenAI credentials unset. Run schema/role/quota tests on dummy accounts first. A real judge test requires an explicitly configured OpenAI credential and incurs its normal small token charge. Razorpay requires separate Test Mode keys/plan/webhook and Clerk requires development configuration. Never copy live secrets into this stack. A localhost webhook cannot receive public Razorpay events without a deliberately configured staging HTTPS endpoint/tunnel; do not expose the n8n editor publicly just to receive webhooks.

The frontend has not been redirected here: production database access requires verified TLS, so local HTTP/no-TLS smoke checks do not prove frontend deployment parity. Follow the main launch handoff for a verified-TLS staging frontend and the remaining provider acceptance matrix.

Verified on 31 October 2026: Docker's main disk moved through its supported Settings UI to `D:\DockerDesktop\DockerDesktopWSL`; C: regained approximately 15 GB. The pre-existing edquest-redis container was restarted and answered PONG. PostgreSQL 17 and n8n/external runners 2.43.6 are running. All five migrations and local login roles initialized successfully. Both quota boundaries passed twelve concurrent reservations across two keys and six concurrent releases (one refund). Web cannot reset Free usage and validator cannot change billing. A temporary webhook probe verified allowed crypto/dns/https/url modules, rejected fs and completed a real n8n PostgreSQL node call. It returned HTTP 200 with zero dummy accounts remaining; the probe was then unpublished and n8n restarted. The temporary credential import JSON was removed.

Still pending: local owner account setup, real OpenAI credential/model evaluation, Clerk test frontend, Razorpay Test Mode/webhook connectivity, full workflow dispatch/failure/recovery and deployed-provider acceptance checks. No real payment/model call or production data modification was performed.

References: [n8n Docker installation](https://docs.n8n.io/hosting/installation/docker/), [external task runners](https://docs.n8n.io/hosting/configuration/task-runners/), [2.43.6 runner defaults](https://github.com/n8n-io/n8n/blob/n8n%402.43.6/docker/images/runners/n8n-task-runners.json).


## Additional checks completed 1 November 2026

- `node scripts/staging-recovery-check.cjs`: real local PostgreSQL cached-verdict retries, old-attempt fencing, single-log recording, erased terminal bodies, exhausted-worker/sync-lease recovery and same-period billing retries. Fixtures and changes are rolled back.
- `node scripts/staging-restore-check.cjs`: pg_dump/pg_restore into a fresh disposable database retained paid plan, Free/paid counters, dates, job functions and restricted web-role permissions. Only generated test artifacts are removed. Database creation needed a 60-second operator timeout on this filesystem; app query deadlines were not changed. This is a local same-cluster restore rehearsal, not proof of the Railway backup/credential process.
- `scripts/prepare-staging-workflow-tests.cjs` prepared separate LOCAL MOCK workflow copies with canned Code-node model responses, leaving the three actual candidates unchanged. Fifteen HTTP/worker checks passed via `node scripts/staging-workflow-check.cjs`. They cover malformed input, key rejection, skip, PASS/BLOCK/high-risk coercion, malformed/injected model output, quota/refund/idempotency, unsafe/unverified destinations, async persistence/completion and cross-account status denial. These verify pipeline behavior, not OpenAI response quality or native model HTTP authentication/timeouts. All mock workflows were unpublished after the test.

## Isolated frontend

`node scripts/staging-frontend.cjs prepare` creates ignored `.cache/staging/frontend.env` without modifying the project's existing environment files. Enter keys from a **separate Clerk development application** there, then run `node scripts/staging-frontend.cjs check` and `node scripts/staging-frontend.cjs start`. It serves http://localhost:3101 using only the local `axon_staging_web` database role. Existing-site Clerk keys are rejected when they match known root/cache configuration; the operator must also ensure this is a different application from the live deployment. The launcher never reads or prints secret values for diagnostic output.

Live provider values in the inherited/root .env configuration are explicitly blanked for this child process. Gmail delivery is disabled. Razorpay remains disabled when all four fields are blank; if enabled later, all fields are required and the key ID must start `rzp_test_`. Never place real `rzp_live_` keys here. The frontend does not silently reuse the site's existing Clerk app, because key provisioning/metadata cleanup could otherwise affect real users even with a local PostgreSQL database. Dedicated staging sign-in and a two-account browser check still require the owner to configure/test that application.


The frontend launcher now binds the canonical `localhost` hostname (matching Clerk's middleware URLs) to avoid a localhost/127.0.0.1 rewrite loop. A separate Clerk development app is configured, and the owner signed in successfully; actual account provisioning and signed-in data requests reached the local database. The local webhook secret may be prepared before API keys/plan are added; that alone does not enable payments. Enter the three Razorpay API key/secret/plan values in Test Mode before restarting the frontend for payment tests. The latest full unit suite passed 66 tests and the production build/typecheck/lint passed. Browser automation helper startup is currently unavailable, so no fresh automated visual/two-account browser result is claimed.


## Razorpay sandbox setup helpers

After saving only Test Mode API key ID and secret, run `node scripts/staging-razorpay-plan.cjs`. It verifies/creates a ₹799 monthly test plan, writes its ID into the ignored local file and retains a create receipt to avoid blind retries. It cannot accept live keys and makes no subscription/payment calls. Restart the local frontend to load the completed configuration. `node scripts/staging-payment-check.cjs` must wait for the existing test checkout to be confirmed active/paid; it does not initiate a payment. Once paid, it verifies ownership/period/limits and locally signed replay handling against canonical Razorpay Test Mode state. An active browser payment callback and actual public webhook delivery are separate checks.
