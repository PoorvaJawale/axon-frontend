"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useAuth, PlanType } from "@/app/context/AuthContext";
import {
  CreditCard,
  Check,
  Shield,
  Download,
  AlertTriangle,
  Building,
  CheckCircle,
  HelpCircle,
  ChevronRight,
  TrendingUp,
  XCircle,
} from "lucide-react";

const fetcher = (url: string, token: string | null) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
  }).then((res) => res.json());

export default function BillingPage() {
  const { userApiKey, userPlan, updatePlan } = useAuth();

  // Live usage from the Axon backend
  const { data: usageData, mutate: mutateUsage } = useSWR(
    userApiKey ? [`/webhook/usage`, userApiKey] : null,
    ([url, token]) => fetcher(url, token),
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  const monthlyRequests = usageData?.monthly_requests ?? 0;
  const requestLimit = usageData?.request_limit ?? 1000;
  const usagePercentage = Math.min((monthlyRequests / requestLimit) * 100, 100);

  // Modal states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
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

  // Upgrading Simulation
  const handleUpgradeClick = () => {
    setIsCheckoutOpen(true);
  };

  const handleConfirmPayment = () => {
    setIsProcessingCheckout(true);
    setTimeout(() => {
      setIsProcessingCheckout(false);
      setIsCheckoutSuccess(true);
      setTimeout(() => {
        updatePlan("Pro");
        mutateUsage();
        setIsCheckoutSuccess(false);
        setIsCheckoutOpen(false);
      }, 1500);
    }, 1800);
  };

  // Downgrading Simulation
  const handleCancelClick = () => {
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = () => {
    updatePlan("Free");
    mutateUsage();
    setIsCancelOpen(false);
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
    } catch (err) {
      setFormError("Failed to submit form. Please verify connection.");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const scrollToSales = () => {
    const el = document.getElementById("contact-sales");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Static Mock Payment History
  const mockInvoices = [
    { id: "inv-001", date: "2026-06-01", amount: "$29.00", status: "PAID" },
    { id: "inv-002", date: "2026-05-01", amount: "$29.00", status: "PAID" },
    { id: "inv-003", date: "2026-04-01", amount: "$29.00", status: "PAID" },
    { id: "inv-004", date: "2026-03-01", amount: "$29.00", status: "FAILED" },
  ];

  return (
    <div className="space-y-8 text-white relative">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your plan subscription, payment details, and volume invoices
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Plan usage card */}
        <div className="md:col-span-2 rounded-xl border border-border/50 bg-[#111111]/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Current Subscription</h3>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {userPlan} Tier
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-sm pt-2">
            <div>
              <p className="text-muted-foreground">Current monthly requests</p>
              <p className="mt-1.5 text-xl font-bold text-white">
                {monthlyRequests.toLocaleString()}{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  / {requestLimit === 10000000 ? "Unlimited" : requestLimit.toLocaleString()} validation limit
                </span>
              </p>
            </div>
            {userPlan === "Pro" && (
              <div>
                <p className="text-muted-foreground">Pricing / Period</p>
                <p className="mt-1.5 text-xl font-bold text-white">
                  $29.00 <span className="text-xs text-muted-foreground font-normal">/ month</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Limit usage</span>
              <span className="font-mono">{usagePercentage.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick billing stats / action helper */}
        <div className="md:col-span-1 rounded-xl border border-border/50 bg-[#111111]/30 p-6 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">Plan Actions</h4>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {userPlan === "Free"
                ? "You are currently utilizing our sandbox environment. Upgrade to lift rate limitations and access judge models."
                : "You are on the Pro tier. Access features like Custom schemas and Slack notifications."}
            </p>
          </div>
          <div className="pt-4">
            {userPlan === "Free" ? (
              <button
                onClick={handleUpgradeClick}
                className="w-full text-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm py-2.5 transition-colors"
              >
                Upgrade to Pro
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={scrollToSales}
                  className="w-full text-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm py-2 transition-colors"
                >
                  Upgrade to Enterprise
                </button>
                <button
                  onClick={handleCancelClick}
                  className="w-full text-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-semibold text-sm py-2 transition-colors"
                >
                  Cancel Plan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Comparisons (Shown if Free) */}
      {userPlan === "Free" && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white">Upgrade to Pro</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Free Card */}
            <div className="rounded-xl border border-border bg-[#111111]/20 p-6 space-y-4">
              <h4 className="text-base font-bold text-white">Free Plan</h4>
              <p className="text-3xl font-black text-white">
                $0 <span className="text-xs text-muted-foreground font-normal">forever</span>
              </p>
              <ul className="text-xs text-muted-foreground space-y-2.5 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  1,000 validations per month
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  Basic JSON schema validation
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  7-day log retention
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  Community Support channels
                </li>
              </ul>
            </div>

            {/* Pro Card */}
            <div className="rounded-xl border border-primary bg-[#111111]/40 p-6 space-y-4 shadow-lg shadow-primary/5 relative">
              <span className="absolute right-4 top-4 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                RECOMMENDED
              </span>
              <h4 className="text-base font-bold text-white">Pro Plan</h4>
              <p className="text-3xl font-black text-white">
                $29 <span className="text-xs text-muted-foreground font-normal">/ month</span>
              </p>
              <ul className="text-xs text-muted-foreground space-y-2.5 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  10,000 validations per month
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  Semantic judge validation model
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  30-day log retention & search
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  Real-time alerts (Slack & Webhooks)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  Priority SLA support responses
                </li>
              </ul>
              <button
                onClick={handleUpgradeClick}
                className="w-full text-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-2.5 transition-colors pt-3"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice / Payment History */}
      {userPlan !== "Free" && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white">Payment History</h3>
          <div className="rounded-xl border border-border/50 bg-[#111111]/30 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50 bg-muted/5">
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Billing Date
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {mockInvoices.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-muted/10">
                    <td className="px-6 py-4 font-mono text-muted-foreground">{inv.date}</td>
                    <td className="px-6 py-4 text-white font-semibold">{inv.amount}</td>
                    <td className="px-6 py-4">
                      {inv.status === "PAID" ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.2 text-[9px] font-bold text-emerald-400">
                          PAID
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.2 text-[9px] font-bold text-red-400">
                          FAILED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => alert(`Downloading Invoice ${inv.id}...`)}
                        className="flex items-center gap-1 font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enterprise Contact Sales Section */}
      <section
        id="contact-sales"
        className="rounded-xl border border-border/50 bg-[#111111]/30 p-6 space-y-6 scroll-mt-24"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 border border-primary/20">
            <Building className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Contact Enterprise Sales</h3>
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
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Work Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Agent Volume <span className="text-red-400">*</span>
                </label>
                <select
                  value={agentVolume}
                  onChange={(e) => setAgentVolume(e.target.value)}
                  className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-sm text-white outline-none focus:border-primary"
                >
                  <option value="1-10">1-10 Active Agents</option>
                  <option value="10-50">10-50 Active Agents</option>
                  <option value="50-200">50-200 Active Agents</option>
                  <option value="200+">200+ Active Agents</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Monthly Validations Estimate <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={validationEstimate}
                  onChange={(e) => setValidationEstimate(e.target.value)}
                  placeholder="e.g. 5,000,000"
                  className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                    className="flex items-center gap-2 rounded-lg border border-border bg-[#0c0c0c] px-3 py-2 cursor-pointer select-none transition-colors hover:border-primary/50"
                  >
                    <input
                      type="checkbox"
                      checked={systems[item.key as keyof typeof systems]}
                      onChange={() => handleSystemChange(item.key as keyof typeof systems)}
                      className="rounded border-border text-primary focus:ring-0 h-4 w-4 bg-[#0a0a0a]"
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
                type="button"
                onClick={() => setOnPremise(!onPremise)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  onPremise ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#111111] shadow ring-0 transition duration-200 ease-in-out ${
                    onPremise ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-white">{onPremise ? "Yes" : "No"}</span>
            </div>

            {/* Text Area: Use Case */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Describe your use case
              </label>
              <textarea
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="Explain the workflow validation pipeline you want to establish..."
                rows={3}
                className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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

      {/* MODAL 1: Upgrading Mock Checkout (Stripe/Razorpay style) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-[460px] rounded-xl border border-primary/20 bg-[#111111] p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2 text-primary font-bold">
                <CreditCard className="h-5 w-5" />
                Axon Pro Checkout
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-muted-foreground hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>

            {isCheckoutSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle className="h-12 w-12 text-primary mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-white">Upgrade Successful</h4>
                <p className="text-xs text-muted-foreground">Welcome to Axon Pro. Upgrading tier limit...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/20 p-3 text-xs flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white">Axon Pro Subscription</p>
                    <p className="text-muted-foreground">10,000 monthly validations</p>
                  </div>
                  <span className="text-base font-bold text-white">$29.00/mo</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      disabled={isProcessingCheckout}
                      placeholder="4111 1111 1111 1111"
                      className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-white placeholder-muted-foreground/50 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        disabled={isProcessingCheckout}
                        placeholder="MM / YY"
                        className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-white placeholder-muted-foreground/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                        CVC
                      </label>
                      <input
                        type="text"
                        disabled={isProcessingCheckout}
                        placeholder="•••"
                        className="w-full rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-white placeholder-muted-foreground/50 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessingCheckout}
                  className="w-full rounded-lg bg-primary text-black font-bold text-sm py-3 hover:bg-primary/90 transition-colors pt-3"
                >
                  {isProcessingCheckout ? "Processing checkout..." : "Confirm & Pay $29.00"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Cancel Pro Subscription Confirmation */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-border bg-[#111111] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-red-400">
              <div className="rounded-lg bg-red-500/10 p-2 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Cancel Plan Subscription?</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to cancel your Pro plan? Your subscription will immediately return to the Free tier limit of 1,000 monthly validations and rate limiting filters will apply.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsCancelOpen(false)}
                className="rounded-lg border border-border hover:bg-muted text-xs font-semibold px-4 py-2 transition-colors"
              >
                No, Keep Pro
              </button>
              <button
                onClick={handleConfirmCancel}
                className="rounded-lg bg-red-500 hover:bg-red-600 text-black text-xs font-semibold px-4 py-2 transition-colors"
              >
                Yes, Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
