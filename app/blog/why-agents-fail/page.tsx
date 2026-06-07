"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ArrowLeft, Calendar, User } from "lucide-react";

export default function WhyAgentsFailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-32 pb-24 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#22c55e]/5 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-3xl">
          {/* Back Button */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors mb-6 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>

          {/* Article Header */}
          <article className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono">
                <span className="inline-flex items-center rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 px-2.5 py-0.5 font-semibold text-primary">
                  Technical
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  June 5, 2026
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Axon Engineering
                </span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-tight">
                Why AI agents fail silently in production
              </h1>
            </div>

            {/* Article Content */}
            <div className="text-xs text-muted-foreground leading-relaxed space-y-6 pt-4 border-t border-border/40">
              <p>
                Most developers building agentic systems discover the same thing the hard way — agents that look completely fine in staging and testing break quietly and unexpectedly in production. When an LLM-based agent produces bad outputs (like generating malformed SQL queries, creating phantom refund promises, or leaking prompt instructions), it does not throw standard runtime exceptions.
              </p>
              
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                1. The Illusion of Deterministic Outputs
              </h2>
              <p>
                Testing an AI agent is fundamentally different from testing traditional software. In a classic web service, given Input A, the system produces Output B. AI agents run on probabilistic models where token outputs drift. A system prompt that performs beautifully over 100 benchmark runs might fail on the 101st run due to minor temperature shifts or complex user contexts.
              </p>

              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                2. Silent Hallucinations
              </h2>
              <p>
                Silent failures are the most dangerous class of bugs. Because there is no syntax crash, the agent continues executing. An email agent might send invalid discount codes directly to customers. An database agent might execute queries that overwrite critical table keys. Without a dedicated validation gateway standing between your agent and external endpoints, you only discover errors from customer reports.
              </p>

              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                3. The Solution: Validation Middleware
              </h2>
              <p>
                The solution is to treat AI outputs as untrusted user inputs. By implementing a plug-and-play validation middleware like Axon, every output undergoes schema enforcement and semantic judge validation. Malformed structures or unsafe logical execution are caught immediately, raising a <code>BLOCK</code> state and preventing the bad output from ever hitting production.
              </p>

              <p className="pt-4 border-t border-border/40">
                Have questions or need assistance setting up semantic output validation? Contact us at{" "}
                <a href="mailto:axonapiai@gmail.com" className="text-[#22c55e] hover:underline">
                  axonapiai@gmail.com
                </a>
                .
              </p>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
