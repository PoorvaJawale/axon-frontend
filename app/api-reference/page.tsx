import { PageFrame } from "@/components/public/page-frame";
import { VALIDATION_URL } from "@/lib/integration-example";
export default function Reference() {
  return (
    <PageFrame
      active="Docs"
      title="API reference."
      description="Validation uses Bearer API keys. Dashboard account routes use your signed-in session."
    >
      <div className="ap-policy">
        <section>
          <h2>POST /webhook/validate</h2>
          <p>
            <code>{VALIDATION_URL}</code>
          </p>
          <p>
            Required: agent_id (string, up to 100 characters), action_type and
            content (string or JSON object, up to 12,000 bytes). The complete
            body is limited to 16,384 bytes. Optional metadata is a JSON object
            up to 2,048 bytes.
          </p>
          <p>
            Actions: email_send, db_write, payment, api_call, live_chat,
            internal_reasoning. Mode defaults to validate_only. Dispatch
            requires a verified execution_endpoint. Caller-supplied risk labels
            cannot bypass the action’s validation route.
          </p>
        </section>
        <section>
          <h2>Responses</h2>
          <dl>
            <dt>200 PASS or BLOCK</dt>
            <dd>
              A completed semantic validation. Check validated and delivery
              separately.
            </dd>
            <dt>200 SKIPPED</dt>
            <dd>Internal reasoning was neither validated nor dispatched.</dd>
            <dt>202 PROCESSING</dt>
            <dd>A background job was durably saved. Do not execute yet.</dd>
            <dt>400</dt>
            <dd>Invalid input. Correct the request before retrying.</dd>
            <dt>401 / 403</dt>
            <dd>Invalid key or an unverified dispatch destination.</dd>
            <dt>409</dt>
            <dd>
              Duplicate request identity. Check the original result or receiver;
              do not create another action blindly.
            </dd>
            <dt>429</dt>
            <dd>
              Quota or request rate exceeded. Free does not refill monthly.
            </dd>
            <dt>503</dt>
            <dd>
              Validation, billing-period initialization or a dependency is
              unavailable. Do not execute.
            </dd>
          </dl>
        </section>
        <section>
          <h2>GET /webhook/validation-status</h2>
          <p>
            Use the validation API host, Bearer key and request_id query
            parameter. Returns the job state and, when available, the verdict. A
            missing or inaccessible job returns 404. Poll with backoff, no
            faster than once every five seconds.
          </p>
        </section>
        <section>
          <h2>Account management</h2>
          <p>
            Manage keys, usage, logs, alert reviews and billing through the
            authenticated dashboard. These website routes are
            session-authorized; customer API keys are not administrative
            credentials.
          </p>
        </section>
      </div>
    </PageFrame>
  );
}
