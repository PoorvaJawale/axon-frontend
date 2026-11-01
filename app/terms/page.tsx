import { PageFrame } from "@/components/public/page-frame";
export const metadata = { title: "Terms of use | Axon" };
export default function Policy() {
  return (
    <PageFrame
      active="Policy"
      title="Terms of use"
      description="The operating terms for Axon’s validation service."
    >
      <div className="ap-policy">
        <p>Updated 31 October 2026.</p>
        <section>
          <h2>About the service</h2>
          <p>
            Axon is an AI validation service operated by Poorva Kiran Jawale in
            India. Axon is the product name and is not presented as a registered
            company. For support or billing questions, email{" "}
            <a href="mailto:axonapi2026@gmail.com">axonapi2026@gmail.com</a>.
          </p>
        </section>
        <section>
          <h2>Service and responsibility</h2>
          <p>
            Axon evaluates AI-generated actions and returns a verdict. Model
            judgments can be wrong. Keep your own authentication, business
            authorization, transaction limits and human review for consequential
            actions. A PASS does not verify real-world facts or guarantee
            safety.
          </p>
        </section>
        <section>
          <h2>Execution modes</h2>
          <p>
            In validate_only mode your application owns execution. In
            validate_and_dispatch mode Axon delivers approved actions to a
            verified destination; the caller must not execute them again. The
            destination must verify signatures and prevent duplicate execution.
            HTTP delivery does not prove downstream execution completed.
          </p>
        </section>
        <section>
          <h2>Plans and usage</h2>
          <p>
            Free includes 100 lifetime validations without a monthly refill. Pro
            costs ₹799 per month for 5,000 validations per paid billing period
            across all account keys. Checkout displays the final payable amount.
            Enterprise capacity and additional commitments require a separate
            agreement. Existing paid plans are handled separately when their
            terms differ.
          </p>
        </section>
        <section>
          <h2>Acceptable use</h2>
          <p>
            Use accounts and keys only with authorization. Do not attack the
            service, bypass limits, send prohibited content, attempt access to
            private networks or forward actions to destinations you do not
            control. Keep keys and signing secrets secure and rotate compromised
            credentials.
          </p>
        </section>
        <section>
          <h2>Billing and support</h2>
          <p>
            Subscriptions renew monthly unless renewal is cancelled. Manage
            renewal in Billing; confirmed cancellation at cycle end preserves
            the paid period. See the cancellation and refund policy for payment
            problems. Contact axonapi2026@gmail.com for support.
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
