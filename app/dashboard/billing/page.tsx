"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/app/context/AuthContext";
import { Building, CheckCircle, Download } from "lucide-react";
import { dashboardFetcher, usagePercent } from "@/lib/dashboard";
import { DashboardDialog, DataState, PageHeader, Status } from "@/components/dashboard/ui";
import { FREE_VALIDATION_LIMIT, PRO_VALIDATION_LIMIT } from "@/lib/plans";
const fetcher = dashboardFetcher;
type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  theme: { color: string };
  handler: (response: Record<string, string>) => Promise<void>;
  modal: { ondismiss: () => void };
};
type RazorpayWindow = Window & { Razorpay?: new (options: RazorpayOptions) => { open: () => void } };

export default function BillingPage() {
  const [billingView, setBillingView] = useState("usage");
  const { userPlan, updatePlan } = useAuth();

  // Live usage from the Axon backend — session cookie authenticates the proxy
  const { data: usageData, error: usageError, isLoading: usageLoading, mutate: mutateUsage } = useSWR(
    "/webhook/usage",
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  const monthlyRequests = usageData?.monthly_requests ?? 0;
  const requestLimit = usageData?.request_limit ?? (userPlan === "Pro" ? PRO_VALIDATION_LIMIT : FREE_VALIDATION_LIMIT);
  const usagePercentage = usagePercent(monthlyRequests, requestLimit);

  // Real payment history from Razorpay (empty until the user has paid invoices)
  const { data: historyData, error: historyError, isLoading: historyLoading, mutate: mutateHistory } = useSWR(
    "/webhook/billing-history",
    fetcher,
    { revalidateOnFocus: true }
  );
  const invoices: { id: string; date: string; amount: string; status: string; url: string | null }[] =
    historyData?.invoices ?? [];

  // Modal states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [paymentNeedsReview, setPaymentNeedsReview] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false);
  
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  // Enterprise form states
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [agentVolume, setAgentVolume] = useState("1-10");
  const [validationEstimate, setValidationEstimate] = useState("");
  
  // Systems checkboxes
  const [systems, setSystems] = useState({
    email: false,
    database: false,
    payments: false,
    customerChat: false,
    internalApis: false,
  });

  const [onPremise, setOnPremise] = useState(false);
  const [useCase, setUseCase] = useState("");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formSubmittedSuccessfully, setFormSubmittedSuccessfully] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSystemChange = (key: keyof typeof systems) => {
    setSystems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Razorpay Checkout
  const handleUpgradeClick = () => {
    setCheckoutError("");
    setIsCheckoutOpen(true);
  };

  const loadRazorpayScript = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if ((window as RazorpayWindow).Razorpay) return resolve();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Razorpay"));
      document.body.appendChild(s);
    });

  const handleConfirmPayment = async () => {
    if (isProcessingCheckout || paymentNeedsReview) return;
    setCheckoutError("");
    setIsProcessingCheckout(true);
    try {
      const res = await fetch("/webhook/razorpay-subscribe", { method: "POST" });
      if (!res.ok) {
        const failure = await res.json().catch(() => null);
        if (failure?.code === "PLAN_MISMATCH") {
          setCheckoutError("Pro checkout is being updated to ₹799/month. Please try again later.");
          setIsProcessingCheckout(false);
          return;
        }
        throw new Error("Could not create subscription");
      }
      const { subscriptionId, keyId } = await res.json();

      await loadRazorpayScript();

      const Razorpay = (window as RazorpayWindow).Razorpay;
      if (!Razorpay) throw new Error("Checkout unavailable");
      const rzp = new Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: "Axon",
        description: "Axon Pro — 5,000 validations/month",
        theme: { color: "#37e39b" },
        handler: async (response: Record<string, string>) => {
          setIsCheckoutOpen(true);
          try {
            const verifyRes = await fetch("/webhook/razorpay-verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            if (verifyRes.ok) {
              setIsCheckoutSuccess(true);
              updatePlan("Pro");
              mutateUsage();
              setTimeout(() => {
                setIsCheckoutSuccess(false);
                setIsCheckoutOpen(false);
              }, 2000);
            } else {
              setPaymentNeedsReview(true);
              setCheckoutError("Payment received but verification failed. Please contact support before attempting another payment.");
            }
          } catch {
            setPaymentNeedsReview(true);
            setCheckoutError("Payment verification was interrupted. Contact support before paying again.");
          } finally {
            setIsProcessingCheckout(false);
          }
        },
        modal: {
          ondismiss: () => { setIsProcessingCheckout(false); setIsCheckoutOpen(true); },
        },
      });
      setIsCheckoutOpen(false);
      rzp.open();
    } catch (err) {
      console.error("Checkout failed to start:", err);
      setCheckoutError("Could not start checkout. Check your connection and try again.");
      setIsProcessingCheckout(false);
    }
  };

  // Sales Form Submission
  const handleSalesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!fullName || !companyName || !workEmail || !validationEstimate) {
      setFormError("Please fill out all required fields.");
      return;
    }

    setIsSubmittingForm(true);
    try {
      const selectedSystems = Object.keys(systems).filter(
        (key) => systems[key as keyof typeof systems]
      );

      const response = await fetch("/webhook/contact-sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          companyName,
          workEmail,
          agentVolume,
          validationEstimate,
          systems: selectedSystems,
          onPremise,
          useCase,
        }),
      });

      if (response.ok) {
        setFormSubmittedSuccessfully(true);
        // Clear fields
        setFullName("");
        setCompanyName("");
        setWorkEmail("");
        setValidationEstimate("");
        setUseCase("");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } catch {
      setFormError("Failed to submit form. Please verify connection.");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const openSales = () => setBillingView("enterprise");

  return (
    <div className="dash-page dash-fit-page dash-billing">
      <PageHeader title="Billing" description="Your plan, validation usage, and payment history."><Status tone="neutral">{userPlan} plan</Status></PageHeader>
      <nav className="dash-segments dash-billing-tabs" aria-label="Billing views">{[["usage", "Usage"], ["plans", "Plans"], ["history", "History"], ["enterprise", "Enterprise"]].map(([value, label]) => <button key={value} aria-pressed={billingView === value} onClick={() => setBillingView(value)}>{label}</button>)}</nav>
      <div className="dash-billing-view" tabIndex={0} role="region" aria-label={billingView === "usage" ? "Current usage" : billingView === "plans" ? "Subscription plans" : billingView === "history" ? "Payment history" : "Enterprise inquiry"}>
      {billingView === "usage" && <div className="dash-billing-overview">
      <section className="dash-billing-usage dash-panel">
        <div className="dash-billing-meter"><div className="dash-section-heading"><h2>{userPlan === "Free" ? "Free validation allowance" : "Monthly validations"}</h2><Status tone={usagePercentage >= 90 ? "amber" : "green"}>{usageError ? "Unavailable" : usageLoading ? "Loading" : usagePercentage >= 90 ? "Near quota" : "Within quota"}</Status></div>
          {usageError ? <DataState error={usageError} retry={() => void mutateUsage()} title="" /> : <><div className="dash-usage-value"><strong className="dash-mono">{usageLoading ? "—" : monthlyRequests.toLocaleString()}</strong><span>of {requestLimit >= 999999999 ? "unlimited" : requestLimit.toLocaleString()} validations</span></div><div className="dash-quota-track" role="meter" aria-label={userPlan === "Free" ? "Free validations used" : "Monthly validations used"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercentage}><span style={{ transform: `scaleX(${usagePercentage / 100})`, background: usagePercentage >= 90 ? "var(--ax-amber)" : "var(--primary)" }} /></div><div className="dash-section-heading dash-small dash-muted" style={{ marginTop: 14 }}><span>{usageLoading ? "Loading usage…" : `${usagePercentage.toFixed(1)}% of ${userPlan === "Free" ? "one-time allowance" : "monthly quota"}`}</span><span>Shared across all keys</span></div></>}
        </div>
        <div className="dash-billing-current"><h2>{userPlan} plan</h2><p>{userPlan === "Free" ? "100 one-time validations to try Axon. No monthly refill." : userPlan === "Pro" ? "5,000 monthly validations with semantic judge validation." : "Custom capacity and support for your organization."}</p><strong>{userPlan === "Free" ? "₹0" : userPlan === "Pro" ? "₹799 / month" : "Custom pricing"}</strong><div className="dash-actions">{userPlan === "Free" ? <button className="dash-button dash-button-primary" onClick={handleUpgradeClick}>Upgrade to Pro</button> : <><button className="dash-button" onClick={openSales}>Contact sales</button>{userPlan === "Pro" && <button className="dash-button dash-button-quiet" onClick={() => setIsCancelOpen(true)}>Manage subscription</button>}</>}</div></div>
      </section>
      </div>}
      {billingView === "plans" && <div className="dash-billing-overview">
      {userPlan === "Free" && <section className="dash-panel dash-plan-comparison" aria-label="Compare subscription plans">
        <div className="dash-table-scroll"><table className="dash-table"><thead><tr><th>Included</th><th><h3>Free</h3><span className="dash-muted">₹0</span></th><th><h3>Pro</h3><span className="dash-green">₹799 / month</span></th></tr></thead><tbody>{[
          ["Validations", "100 total · one-time", "5,000 / month"],
          ["Validation", "JSON schema", "Schema + semantic judge"],
          ["Log retention", "7 days", "30 days + search"],
          ["Alerts", "—", "Slack + webhooks"],
          ["Support", "Community", "Priority SLA"],
        ].map(([feature, free, pro]) => <tr key={feature}><td>{feature}</td><td className="dash-muted">{free}</td><td>{pro}</td></tr>)}</tbody></table></div><div className="dash-pagination"><Status tone="neutral">Free is your current plan</Status><button className="dash-button dash-button-primary" onClick={handleUpgradeClick}>Upgrade to Pro</button></div>
      </section>}
      {userPlan !== "Free" && <section className="dash-panel dash-summary"><h2>{userPlan} plan</h2><p>{userPlan === "Pro" ? "5,000 validations per month, semantic judge validation, 30-day log retention, and priority support." : "Custom capacity and support for your organization."}</p><button className="dash-button" onClick={openSales}>Discuss your plan</button></section>}
      </div>}
      {billingView === "history" && <section className="dash-panel"><div className="dash-panel-heading"><div><h2>Payment history</h2><p>Invoices from your subscription payments.</p></div></div>{historyLoading || historyError || !invoices.length ? <DataState loading={historyLoading} error={historyError} retry={() => void mutateHistory()} title="No payments yet" description="Your invoices will appear here after your first subscription charge." /> : <div className="dash-table-scroll"><table className="dash-table"><thead><tr><th>Billing date</th><th>Amount</th><th>Status</th><th>Invoice</th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.id}><td className="dash-mono">{invoice.date}</td><td>{invoice.amount}</td><td><Status tone={invoice.status === "PAID" ? "green" : "amber"}>{invoice.status}</Status></td><td>{invoice.url ? <a className="dash-text-link" href={invoice.url} target="_blank" rel="noopener noreferrer"><Download size={14} />View invoice</a> : "—"}</td></tr>)}</tbody></table></div>}</section>
      }
      {/* Enterprise Contact Sales Section */}
      {billingView === "enterprise" && (
      <section
        id="contact-sales"
        className="rounded-xl border border-border/50 bg-[#0a0d0c]/30 p-6 space-y-6 scroll-mt-24"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 border border-primary/20">
            <Building className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Talk to enterprise sales</h3>
            <p className="text-xs text-muted-foreground">
              Request details on custom SLA compliance, private cloud hosting, or volume pricing plans.
            </p>
          </div>
        </div>

        {formSubmittedSuccessfully ? (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-8 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-primary mx-auto" />
            <h4 className="text-lg font-bold text-white">Submission Confirmed</h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Thanks! We will reach out within 24 hours to schedule a custom validation pipeline demo.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSalesSubmit} className="space-y-4">
            {formError && (
              <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sales-name" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="sales-name" value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-border bg-[#080b0a] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="sales-company" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="sales-company" value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full rounded-lg border border-border bg-[#080b0a] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label htmlFor="sales-email" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Work Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  id="sales-email" value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full rounded-lg border border-border bg-[#080b0a] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="sales-agents" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Agent Volume <span className="text-red-400">*</span>
                </label>
                <select
                  id="sales-agents" value={agentVolume}
                  onChange={(e) => setAgentVolume(e.target.value)}
                  className="w-full rounded-lg border border-border bg-[#080b0a] px-3.5 py-2 text-sm text-white outline-none focus:border-primary"
                >
                  <option value="1-10">1-10 Active Agents</option>
                  <option value="10-50">10-50 Active Agents</option>
                  <option value="50-200">50-200 Active Agents</option>
                  <option value="200+">200+ Active Agents</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="sales-volume" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Monthly Validations Estimate <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="sales-volume" value={validationEstimate}
                  onChange={(e) => setValidationEstimate(e.target.value)}
                  placeholder="e.g. 5,000,000"
                  className="w-full rounded-lg border border-border bg-[#080b0a] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Checkboxes: Systems Touched */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Systems your agents touch
              </label>
              <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-5 text-xs">
                {[
                  { key: "email", label: "Email Clients" },
                  { key: "database", label: "Databases" },
                  { key: "payments", label: "Payments (Stripe)" },
                  { key: "customerChat", label: "Customer Chat" },
                  { key: "internalApis", label: "Internal APIs" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 rounded-lg border border-border bg-[#080b0a] px-3 py-2 cursor-pointer select-none transition-colors hover:border-primary/50"
                  >
                    <input
                      type="checkbox"
                      checked={systems[item.key as keyof typeof systems]}
                      onChange={() => handleSystemChange(item.key as keyof typeof systems)}
                      className="rounded border-border text-primary focus:ring-0 h-4 w-4 bg-[#080b0a]"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Toggle: Need on-premise deployment? */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide select-none">
                Need on-premise deployment?
              </label>
              <button
                type="button" role="switch" aria-checked={onPremise} aria-label="On-premise deployment"
                onClick={() => setOnPremise(!onPremise)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  onPremise ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#0a0d0c] shadow ring-0 transition duration-200 ease-in-out ${
                    onPremise ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-white">{onPremise ? "Yes" : "No"}</span>
            </div>

            {/* Text Area: Use Case */}
            <div>
              <label htmlFor="sales-use-case" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Describe your use case
              </label>
              <textarea
                id="sales-use-case" value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="Explain the workflow validation pipeline you want to establish..."
                rows={3}
                className="w-full rounded-lg border border-border bg-[#080b0a] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingForm}
              className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-6 py-2.5 transition-colors disabled:opacity-50"
            >
              {isSubmittingForm ? "Submitting Inquiry..." : "Submit Inquiry"}
            </button>
          </form>
        )}
      </section>

      )}
      </div>
      {isCheckoutOpen && <DashboardDialog title="Upgrade to Axon Pro" busy={isProcessingCheckout} onClose={() => setIsCheckoutOpen(false)}>{isCheckoutSuccess ? <DataState title="You're on Pro" description="Your payment was verified and your plan has been updated." /> : <><p>5,000 validations per month, semantic judge validation, and longer log retention.</p><dl className="dash-definition"><div><dt>Plan</dt><dd>Axon Pro</dd></div><div><dt>Billed monthly</dt><dd>₹799</dd></div></dl><p style={{ marginTop: 20 }}>Renews monthly. Review the final amount in Razorpay before confirming payment.</p>{checkoutError && <div className="dash-field-error" role="alert">{checkoutError}</div>}<div className="dash-actions"><button className="dash-button dash-button-primary" disabled={isProcessingCheckout || paymentNeedsReview} onClick={handleConfirmPayment}>{isProcessingCheckout ? "Opening secure checkout…" : "Continue to payment"}</button></div></>}</DashboardDialog>}
      {isCancelOpen && <DashboardDialog title="Manage your subscription" onClose={() => setIsCancelOpen(false)}><p>Subscription cancellation isn’t connected in this dashboard yet. Contact support to request cancellation. Your current plan and billing have not changed.</p><div className="dash-actions"><button className="dash-button" onClick={() => setIsCancelOpen(false)}>Close</button><button className="dash-button dash-button-primary" onClick={() => { setIsCancelOpen(false); openSales(); }}>Contact the team</button></div></DashboardDialog>}
    </div>
  );
}
