"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ArrowLeft, Sparkles, Database, ShieldAlert } from "lucide-react";

const changelogEntries = [
  {
    version: "v1.0.0",
    date: "June 2026",
    badge: "Latest",
    badgeColor: "bg-[#37e39b]/10 border-[#37e39b]/25 text-[#37e39b]",
    title: "Public Beta Launch",
    icon: Sparkles,
    changes: [
      "Two-layer validation engine — schema + semantic judge",
      "Support for 5 action types: email, database, payment, chat, api_call",
      "Real-time developer dashboard",
      "Async background validation for live chat",
      "API key management with SHA-256 hashing",
      "Plan-based rate limiting: Free, Pro, Enterprise",
      "Monthly usage reset",
      "Gmail alerts on blocked outputs",
      "Error logging system",
    ],
  },
  {
    version: "v0.9.0",
    date: "May 2026",
    badge: "Beta",
    badgeColor: "bg-secondary border-border/80 text-muted-foreground",
    title: "Beta Infrastructure",
    icon: Database,
    changes: [
      "n8n workflow architecture deployed",
      "PostgreSQL database schema finalized",
      "Background semantic validator sub-workflow",
      "HMAC webhook signature verification",
      "Retry logic on judge model — 3 attempts",
    ],
  },
  {
    version: "v0.8.0",
    date: "April 2026",
    badge: "Alpha",
    badgeColor: "bg-secondary border-border/80 text-muted-foreground",
    title: "Alpha Release",
    icon: ShieldAlert,
    changes: [
      "Initial validation pipeline",
      "Basic schema checking with Pydantic",
      "First version of judge model integration",
      "Webhook-based API design",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-12 pb-16 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-1/4 h-[400px] w-[400px] rounded-full bg-[#37e39b]/3 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-4xl">
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors mb-8 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="mb-12">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Changelog
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              What is new in Axon. Keep up to date with our releases.
            </p>
          </div>

          {/* List of Entries */}
          <div className="space-y-8">
            {changelogEntries.map((entry) => (
              <div
                key={entry.version}
                className="rounded-xl border border-border bg-[#0a0d0c]/30 p-6 md:p-8 backdrop-blur-sm relative overflow-hidden transition-all duration-300 hover:border-border/80"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-secondary border border-border/80 text-muted-foreground">
                      <entry.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold text-white">
                          {entry.version}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${entry.badgeColor}`}
                        >
                          {entry.badge}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-white mt-0.5">
                        {entry.title}
                      </h2>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide md:text-right">
                    Released: {entry.date}
                  </span>
                </div>

                <ul className="space-y-3 pl-4 list-disc text-xs text-muted-foreground leading-relaxed">
                  {entry.changes.map((change, idx) => (
                    <li key={idx} className="hover:text-white transition-colors">
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
