"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

export default function EnterpriseContactPage() {
  // Form states
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [agentsCount, setAgentsCount] = useState("");
  const [monthlyVolume, setMonthlyVolume] = useState("");
  const [useCase, setUseCase] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [onPremise, setOnPremise] = useState(false);

  // Checkboxes state
  const [systems, setSystems] = useState({
    emailSending: false,
    databaseWrites: false,
    paymentProcessing: false,
    customerChat: false,
    internalApis: false,
    other: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSystemChange = (key: keyof typeof systems) => {
    setSystems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validate required fields
    if (
      !fullName ||
      !workEmail ||
      !companyName ||
      !agentsCount ||
      !monthlyVolume ||
      !useCase
    ) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

    setIsLoading(true);

    // Format selected systems
    const selectedSystemsList = Object.entries(systems)
      .filter(([_, checked]) => checked)
      .map(([name]) => {
        const labels: Record<string, string> = {
          emailSending: "Email sending",
          databaseWrites: "Database writes",
          paymentProcessing: "Payment processing",
          customerChat: "Customer-facing chat",
          internalApis: "Internal APIs",
          other: "Other",
        };
        return labels[name] || name;
      });

    try {
      const response = await fetch("/webhook/contact-sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          workEmail,
          companyName,
          jobTitle: jobTitle || "Not Specified",
          agentsCount,
          monthlyVolume,
          systems: selectedSystemsList,
          onPremise,
          useCase,
          heardFrom: heardFrom || "Not Specified",
        }),
      });

      if (response.ok) {
        setIsSuccess(true);
      } else {
        const errText = await response.text();
        console.error("Contact sales error response:", errText);
        setErrorMsg("Something went wrong. Please email us directly at axonapiai2026@gmail.com");
      }
    } catch (err) {
      console.error("Fetch error submitting form:", err);
      setErrorMsg("Something went wrong. Please email us directly at axonapiai2026@gmail.com");
    } finally {
      setIsLoading(false);
    }
  };

  const firstName = fullName.trim().split(" ")[0];

  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-32 pb-24 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#37e39b]/5 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-4xl">
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors mb-6 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          {isSuccess ? (
            /* Confirmation card */
            <div className="rounded-xl border border-border bg-[#0a0d0c] p-8 md:p-12 text-center max-w-2xl mx-auto shadow-2xl space-y-6">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#37e39b]/10 border border-[#37e39b]/20 text-[#37e39b]">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Thank you, {firstName}!
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We have received your inquiry and will reach out to axonapiai@gmail.com within 24 hours.
                </p>
              </div>
              <div className="pt-4">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-lg bg-[#37e39b] px-6 py-2.5 text-sm font-semibold text-[#000000] transition-colors hover:bg-[#37e39b]/90 w-full sm:w-auto"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          ) : (
            /* Form view */
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Talk to Sales
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tell us about your use case and we will reach out within 24 hours.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-[#0a0d0c] p-6 md:p-8 shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Full Name */}
                    <div>
                      <label
                        htmlFor="fullName"
                        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                      >
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full rounded-lg border border-[#1f2937] bg-[#070908] px-3.5 py-2.5 text-sm text-white placeholder-muted-foreground/40 outline-none transition-all focus:border-[#37e39b] focus:ring-1 focus:ring-[#37e39b]"
                      />
                    </div>

                    {/* Work Email */}
                    <div>
                      <label
                        htmlFor="workEmail"
                        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                      >
                        Work Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="workEmail"
                        type="email"
                        required
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        placeholder="jane@company.com"
                        className="w-full rounded-lg border border-[#1f2937] bg-[#070908] px-3.5 py-2.5 text-sm text-white placeholder-muted-foreground/40 outline-none transition-all focus:border-[#37e39b] focus:ring-1 focus:ring-[#37e39b]"
                      />
                    </div>

                    {/* Company Name */}
                    <div>
                      <label
                        htmlFor="companyName"
                        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                      >
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="companyName"
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Corp"
                        className="w-full rounded-lg border border-[#1f2937] bg-[#070908] px-3.5 py-2.5 text-sm text-white placeholder-muted-foreground/40 outline-none transition-all focus:border-[#37e39b] focus:ring-1 focus:ring-[#37e39b]"
                      />
                    </div>

                    {/* Job Title */}
                    <div>
                      <label
                        htmlFor="jobTitle"
                        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                      >
                        Job Title <span className="text-muted-foreground/50 lowercase italic">(optional)</span>
                      </label>
                      <input
                        id="jobTitle"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Lead AI Architect"
                        className="w-full rounded-lg border border-[#1f2937] bg-[#070908] px-3.5 py-2.5 text-sm text-white placeholder-muted-foreground/40 outline-none transition-all focus:border-[#37e39b] focus:ring-1 focus:ring-[#37e39b]"
                      />
                    </div>

                    {/* AI Agents Running Dropdown */}
                    <div>
                      <label
                        htmlFor="agentsCount"
                        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                      >
                        How many AI agents are you running? <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="agentsCount"
                        required
                        value={agentsCount}
                        onChange={(e) => setAgentsCount(e.target.value)}
                        className="w-full rounded-lg border border-[#1f2937] bg-[#070908] px-3.5 py-2.5 text-sm text-white placeholder-muted-foreground/40 outline-none focus:border-[#37e39b]"
                      >
                        <option value="" disabled>Select agent count...</option>
                        <option value="1 to 10">1 to 10</option>
                        <option value="10 to 50">10 to 50</option>
                        <option value="50 to 200">50 to 200</option>
                        <option value="200+">200+</option>
                      </select>
                    </div>

                    {/* Estimated Monthly Volume Dropdown */}
                    <div>
                      <label
                        htmlFor="monthlyVolume"
                        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                      >
                        Estimated monthly validation volume? <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="monthlyVolume"
                        required
                        value={monthlyVolume}
                        onChange={(e) => setMonthlyVolume(e.target.value)}
                        className="w-full rounded-lg border border-[#1f2937] bg-[#070908] px-3.5 py-2.5 text-sm text-white placeholder-muted-foreground/40 outline-none focus:border-[#37e39b]"
                      >
                        <option value="" disabled>Select monthly volume...</option>
                        <option value="Under 10,000">Under 10,000</option>
                        <option value="10,000 to 100,000">10,000 to 100,000</option>
                        <option value="100,000 to 1,000,000">100,000 to 1,000,000</option>
                        <option value="Over 1,000,000">Over 1,000,000</option>
                      </select>
                    </div>

                    {/* How heard dropdown */}
                    <div className="md:col-span-2">
                      <label
                        htmlFor="heardFrom"
                        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                      >
                        How did you hear about Axon? <span className="text-muted-foreground/50 lowercase italic">(optional)</span>
                      </label>
                      <select
                        id="heardFrom"
                        value={heardFrom}
                        onChange={(e) => setHeardFrom(e.target.value)}
                        className="w-full rounded-lg border border-[#1f2937] bg-[#070908] px-3.5 py-2.5 text-sm text-white placeholder-muted-foreground/40 outline-none focus:border-[#37e39b]"
                      >
                        <option value="">Select an option...</option>
                        <option value="Google">Google</option>
                        <option value="Reddit">Reddit</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Twitter">Twitter</option>
                        <option value="Word of mouth">Word of mouth</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Checkboxes: Target Systems */}
                    <div className="md:col-span-2 space-y-3">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Which systems do your agents interact with?
                      </span>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
                        {[
                          { key: "emailSending", label: "Email sending" },
                          { key: "databaseWrites", label: "Database writes" },
                          { key: "paymentProcessing", label: "Payment processing" },
                          { key: "customerChat", label: "Customer-facing chat" },
                          { key: "internalApis", label: "Internal APIs" },
                          { key: "other", label: "Other" },
                        ].map((item) => (
                          <label
                            key={item.key}
                            className="flex items-center gap-2.5 rounded-lg border border-border bg-[#070908] px-3.5 py-3.5 cursor-pointer select-none transition-colors hover:border-[#37e39b]/50"
                          >
                            <input
                              type="checkbox"
                              checked={systems[item.key as keyof typeof systems]}
                              onChange={() => handleSystemChange(item.key as keyof typeof systems)}
                              className="rounded border-[#1f2937] text-[#37e39b] focus:ring-0 h-4 w-4 bg-[#070908] cursor-pointer"
                            />
                            <span className="text-muted-foreground font-medium">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* On-premise toggle */}
                    <div className="md:col-span-2 flex items-center gap-3 py-2 border-t border-border/30">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                        Do you require on-premise deployment?
                      </label>
                      <button
                        type="button"
                        onClick={() => setOnPremise(!onPremise)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          onPremise ? "bg-[#37e39b]" : "bg-secondary"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#0a0d0c] shadow ring-0 transition duration-200 ease-in-out ${
                            onPremise ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span className="text-xs font-bold text-white">{onPremise ? "Yes" : "No"}</span>
                    </div>

                    {/* Use Case Textarea */}
                    <div className="md:col-span-2">
                      <label
                        htmlFor="useCase"
                        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                      >
                        Tell us about your use case <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="useCase"
                        required
                        value={useCase}
                        onChange={(e) => setUseCase(e.target.value)}
                        placeholder="Describe what your agents do and what problems you are facing with AI output reliability..."
                        rows={5}
                        className="w-full rounded-lg border border-[#1f2937] bg-[#070908] px-3.5 py-2.5 text-sm text-white placeholder-muted-foreground/40 outline-none transition-all focus:border-[#37e39b] focus:ring-1 focus:ring-[#37e39b] leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Submission and Error Display */}
                  <div className="space-y-4 pt-2 border-t border-border/30">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full rounded-lg bg-[#37e39b] py-3 text-sm font-semibold text-[#000000] transition-colors hover:bg-[#37e39b]/90 focus:outline-none focus:ring-2 focus:ring-[#37e39b] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isLoading ? "Sending Inquiry..." : "Send to Sales Team"}
                    </button>

                    {errorMsg && (
                      <div className="flex items-center gap-2 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/25 p-3.5 rounded-lg">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
