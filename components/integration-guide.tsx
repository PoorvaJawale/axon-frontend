import "@/components/public/public-pages.css";
import { integrationExample } from "@/lib/integration-example";
export function IntegrationGuide() {
  return (
    <div className="ap-policy">
      <section>
        <h2>Validate only</h2>
        <p>
          Use mode <code>validate_only</code> when your application executes the
          action. Execute only after an HTTP success with{" "}
          <code>validated: true</code> and <code>status: PASS</code>. Treat
          other states as a hold, including skipped internal reasoning.
        </p>
        <pre>{integrationExample}</pre>
      </section>
      <section>
        <h2>Validate and dispatch</h2>
        <p>
          Register and verify your HTTPS destination in API Keys. Use{" "}
          <code>mode: validate_and_dispatch</code> and its exact{" "}
          <code>execution_endpoint</code>. Axon delivers PASS actions to that
          endpoint. Your caller must not execute the action a second time. BLOCK
          actions are never dispatched.
        </p>
        <p>
          A successful delivery means the endpoint accepted the HTTP request; it
          does not prove the downstream action executed. An unconfirmed delivery
          requires checking the receiver before retrying.
        </p>
      </section>
      <section>
        <h2>Background validation</h2>
        <p>
          The <code>live_chat</code> action queues validation and returns HTTP
          202 with a request ID. It does not mean the message was delivered or
          approved. Poll <code>/webhook/validation-status?request_id=…</code> on
          the same API host using your Bearer key. Wait for a terminal result
          before allowing an action.
        </p>
      </section>
      <section>
        <h2>Authenticate callbacks</h2>
        <p>
          Save the signing secret shown once after destination verification.
          Check HMAC-SHA256 over the timestamp, a dot, and the exact raw request
          bytes. Compare against <code>x-axon-signature</code> using a
          constant-time comparison. Reject timestamps outside five minutes.
          Persist <code>x-axon-event-id</code> with the action in one
          transaction so retries cannot execute twice. Only the signed{" "}
          <code>action.approved</code> event authorizes dispatch.
        </p>
      </section>
      <section>
        <h2>Limits and billing</h2>
        <p>
          Free includes 100 lifetime validations. Pro is ₹799 per month for
          5,000 validations per paid billing period, shared across keys. A valid
          semantic PASS or BLOCK consumes one validation. Invalid input and
          skipped internal reasoning do not. Internal model failures release
          their reservation. Delivery failures retain the charge for the
          completed validation.
        </p>
        <p>
          Send a stable idempotency key when retrying an action. A duplicate
          returns 409 and does not grant another reservation. API keys expire
          after 90 days; rotate them in the dashboard. Revoking keys does not
          affect access to your account.
        </p>
      </section>
    </div>
  );
}
