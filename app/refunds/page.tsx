import { PageFrame } from "@/components/public/page-frame";
export const metadata = { title: "Cancellation and refunds | Axon" };
export default function Policy() {
  return (
    <PageFrame
      active="Policy"
      title="Cancellation and refunds"
      description="How to stop renewal or resolve a payment problem."
    >
      <div className="ap-policy">
        <p>Updated 31 October 2026.</p>
        <section>
          <h2>Stop renewal</h2>
          <p>
            Open Dashboard → Billing → Manage subscription and confirm Cancel
            renewal. Wait for confirmation and check the effective date. Access
            continues through the confirmed paid period. Cancellation does not
            itself refund the current payment.
          </p>
        </section>
        <section>
          <h2>Paid but not activated</h2>
          <p>
            Use Restore paid subscription or Check activation to verify the
            existing payment. This does not initiate another payment. Do not pay
            again to resolve activation problems. Send support the Razorpay
            subscription/payment reference, account email and payment date;
            never send card details or secret keys.
          </p>
        </section>
        <section>
          <h2>Refund requests</h2>
          <p>
            Email axonapi2026@gmail.com with the payment reference and reason.
            Support reviews duplicate charges, payment errors and service issues
            with Razorpay. Refund eligibility, amount and timing are confirmed
            individually; this page does not promise an automatic refund.
          </p>
        </section>
        <section>
          <h2>Account deletion</h2>
          <p>
            Requesting deletion does not cancel a recurring subscription
            automatically. Cancel renewal and verify its status before
            completing account closure.
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
