# Connect Axon’s Status page

The frontend now checks real endpoints when someone opens /status. It refreshes every 60 seconds while the page is visible. There is no monitoring subscription, OpenAI call, quota update, or scheduled workflow. Requests use existing hosting resources.

## 1. Create a separate n8n workflow

Name it **Axon Health**. Do not modify the validation, payment, or quota workflows.

Add these nodes:

Health webhook → Database check → Healthy response
                                ↘ Database unavailable (error output)

### Health webhook (Webhook node)

- Rename the node exactly **Health webhook**.
- HTTP method: **GET**.
- Path: **axon-health**.
- Authentication: **Header Auth**.
- Create a dedicated Header Auth credential:
  - Name: **x-axon-health-secret**.
  - Value: a new random secret. Use a different secret from signup, billing, and customer API keys.
- Respond: **Using Respond to Webhook Node**.
- Use the **Production URL**, not the test URL or n8n editor URL.

You can generate the secret locally in PowerShell:

~~~powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
~~~

Store the value in the credential and Vercel environment settings. Do not commit it or paste it into chat.

### Database check (Postgres node)

- Credential: **Axon DB** (the same database used by your validation workflow).
- Operation: **Execute Query**.
- Query:

~~~sql
SELECT 1 AS healthy;
~~~

- Settings → On Error: **Continue (using error output)**.
- Connect the normal output to **Healthy response**.
- Connect the error output to **Database unavailable**.

This only tests database connectivity and query execution. It does not validate quota tables, write data, run the judge, or execute any customer action.

### Healthy response (Respond to Webhook node)

- Respond With: **JSON**.
- Response Code: **200**.
- Set Response Body to **Expression** and paste the following. Do not add another equals sign before it:

~~~javascript
{{ {
  service: 'axon-health',
  request_id: $('Health webhook').first().json.headers['x-axon-health-request-id'],
  database: 'ok'
} }}
~~~

- Options → Response Headers: **Cache-Control** = **no-store**.

### Database unavailable (Respond to Webhook node)

- Respond With: **JSON**.
- Response Code: **503**.
- Response Body, in Expression mode:

~~~javascript
{{ {
  service: 'axon-health',
  request_id: $('Health webhook').first().json.headers['x-axon-health-request-id'],
  database: 'error'
} }}
~~~

- Options → Response Headers: **Cache-Control** = **no-store**.
- Do not return the Postgres error, connection details, or incoming request headers.

Publish/activate the workflow. Keep successful execution saving off for this health workflow if you do not need those logs; its inbound headers contain the monitoring credential. Restrict access to n8n execution data.

## 2. Configure the frontend

In Vercel → Axon project → Settings → Environment Variables, add these server-only values for the intended deployment environment:

| Variable | Value |
| --- | --- |
| AXON_PUBLIC_SITE_URL | https://axon-frontend-vxa8.vercel.app (or your actual public deployment URL) |
| AXON_HEALTHCHECK_URL | Copy the activated workflow’s Production URL, ending in /webhook/axon-health |
| AXON_HEALTHCHECK_SECRET | Exactly the value in the n8n Header Auth credential |

Redeploy after saving. Do not prefix these names with NEXT_PUBLIC_. No signup or customer API key is used.

For local development, place the same variables in .env.local, but set AXON_PUBLIC_SITE_URL to http://localhost:3000 (use your actual dev-server port). Restart the dev server. The production backend health URL can stay the same.

If AXON_PUBLIC_SITE_URL is omitted on Vercel, the server falls back to VERCEL_PROJECT_PRODUCTION_URL, then VERCEL_URL. Set it explicitly to avoid ambiguity. A protected preview deployment may return Unknown until its health endpoint is reachable. Redirects are deliberately rejected: use the final canonical HTTPS URL.

## 3. Verify the connection

1. Open /api/health on the frontend: it should return service axon-web and status ok. This endpoint only checks the web application server.
2. Open /api/status on the frontend: it should return three service results. It never includes secrets, database errors, or private URLs.
3. Open /status: the web app, backend workflow, and database should show Operational when their checks succeed. Check now can reuse a result collected in the previous 30 seconds.
4. With a wrong health secret, backend/database must not appear Operational. Backend will show Unknown for authentication/configuration errors.
5. Check the database error branch with a temporary test copy of this health workflow. Do not disrupt the production database to test monitoring. The failure branch must return HTTP 503 and database error, echoing the request ID.

The server sends a unique x-axon-health-request-id on each fresh check. n8n must echo it unchanged; this verifies that a fresh workflow actually handled the request. Responses are limited to 16 KiB, checks time out after 5 seconds, and redirects are not followed. Successful responses slower than 2 seconds are labeled Slow response for the web app/backend. Database response duration is not measured separately.

## What the public labels mean

- **Operational:** the most recent configured check succeeded.
- **Slow response:** the check succeeded but took more than 2 seconds.
- **Check failed:** a request failed/timed out or the database test failed. This does not establish a sustained outage.
- **Unknown:** missing configuration, an unexpected/authentication response, or no recent trustworthy result.

The frontend discards green results after two minutes without a recent result and also shows Unknown if refreshing fails. Polling pauses when the page is hidden or offline and resumes on focus/reconnection. There is no historical uptime percentage or continuous alerting.

The web check does not prove sign-in works. The backend health workflow does not prove validation, the semantic judge, or background jobs work. Those require separate safe tests before they can be advertised as monitored.

Checks are cached for 30 seconds per server instance and overlapping requests share one check. The response also allows a 30-second CDN cache; cache sharing is best effort across server instances. This is visitor-triggered monitoring: no visitors means no scheduled checks. If the frontend itself goes offline, this page cannot report its own outage. Independent monitoring can be added later if needed.

Existing published incident entries are separate editorial content and are not generated by these checks.

References: [n8n Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/), [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/).
