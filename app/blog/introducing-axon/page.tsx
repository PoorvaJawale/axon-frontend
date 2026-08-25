"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ArrowLeft, Calendar, User } from "lucide-react";

export default function IntroducingAxonPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-12 pb-16 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#37e39b]/5 blur-[100px]" />
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
                <span className="inline-flex items-center rounded-full bg-[#37e39b]/10 border border-[#37e39b]/20 px-2.5 py-0.5 font-semibold text-primary">
                  Product
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  May 28, 2026
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Axon Team
                </span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-tight">
                Introducing Axon: The validation layer for AI agents
              </h1>
            </div>

            {/* Article Content */}
            <div className="text-xs text-muted-foreground leading-relaxed space-y-6 pt-4 border-t border-border/40">
              <p>
                Today we are thrilled to launch Axon in public beta. Axon is a developer-first validation gateway that sits between your AI agent stack and critical external APIs, databases, or user-facing messaging tools.
              </p>
              
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Why Axon?
              </h2>
              <p>
                As AI systems transition from chatbots to autonomous agents, their impact on production environments scales exponentially. An agent that can execute SQL, make payments, or send client communications needs guardrails. We designed Axon to provide those guardrails with minimal friction.
              </p>

              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Key Features
              </h2>
              <p>
                Axon is packed with powerful features to bring security and predictability to your workflows:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Two-layer verification:</strong> Combine fast structural JSON schema validation with our custom judge models that verify semantic requirements.
                </li>
                <li>
                  <strong>Action Types:</strong> Out-of-the-box support for validating emails, database operations, payments, chat window moderation, and custom API calls.
                </li>
                <li>
                  <strong>Developer Dashboard:</strong> Monitor validations in real time, regenerate access credentials, and audit security events.
                </li>
              </ul>

              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Getting Started
              </h2>
              <p>
                Integrating Axon takes less than five minutes. Simply sign up for a developer account, retrieve your API key, and route agent executions through our REST verification endpoint. Refer to our API docs to configure schemas and judge rules.
              </p>

              <p className="pt-4 border-t border-border/40">
                For partnerships, enterprise features, or queries, please reach out to us at{" "}
                <a href="mailto:axonapiai@gmail.com" className="text-[#37e39b] hover:underline">
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
