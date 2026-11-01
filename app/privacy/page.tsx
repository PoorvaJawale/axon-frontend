import { PageFrame } from "@/components/public/page-frame";
export const metadata = { title: "Privacy | Axon" };
export default function Policy() {
  return (
    <PageFrame
      active="Policy"
      title="Privacy"
      description="What Axon processes and how to contact us about your data."
    >
      <div className="ap-policy">
        <p>Updated 31 October 2026.</p>
        <section>
          <h2>Data processed</h2>
          <p>
            Axon processes account identity, API key hashes, subscription
            references, usage counters, validation decisions and support
            messages. Validation content is sent to OpenAI for semantic
            evaluation. Background jobs temporarily hold content until
            processing or expiry. Do not submit passwords, payment card details,
            access tokens or data you lack permission to share.
          </p>
        </section>
        <section>
          <h2>Providers and storage</h2>
          <p>
            Clerk provides authentication; Vercel hosts the website; Railway
            hosts backend services and PostgreSQL; OpenAI provides semantic
            evaluation; Razorpay processes payments. Sales inquiries are
            delivered through our configured Gmail mailbox. These providers have
            their own data-handling terms. Axon does not collect your card
            details through its own forms.
          </p>
        </section>
        <section>
          <h2>Retention and access</h2>
          <p>
            Validation history is retained according to the configured account
            policy. New validation logs record decision metadata rather than
            full output content. Temporary jobs, n8n execution settings and
            backups also affect retention; contact support for the configuration
            applicable to your deployment. Staff access should be limited to
            operating and supporting the service.
          </p>
        </section>
        <section>
          <h2>Your requests</h2>
          <p>
            Use Account data requests in Billing to request an export or
            deletion. Requests are reviewed by support and are not immediate
            deletion commands. Billing records or backups may require separate
            retention and handling; support will explain what is removed and any
            remaining retention. Cancel subscription renewal separately before
            closing your account.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            Email axonapi2026@gmail.com for privacy, access or deletion
            requests.
          </p>
        </section>
        <p>
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
          <a href="/refunds">Cancellation and refunds</a>
        </p>
      </div>
    </PageFrame>
  );
}
