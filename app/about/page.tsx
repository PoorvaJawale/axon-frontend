"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ArrowLeft, Target, ShieldAlert, Mail } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-32 pb-24 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#22c55e]/5 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-3xl space-y-12">
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              About Axon
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Built by developers, for developers. Learn more about our mission.
            </p>
          </div>

          <div className="space-y-10">
            {/* Mission Section */}
            <section className="rounded-xl border border-border bg-[#111111]/30 p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <Target className="h-5 w-5" />
                <h2 className="text-lg font-bold text-white">Our Mission</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI agents are being deployed into production systems faster than the safety infrastructure can keep up. Axon exists to close that gap. We build the trust layer that sits between AI agents and the real world — so developers can ship AI-powered products with confidence, knowing that hallucinations and malformed outputs are caught before they cause damage.
              </p>
            </section>

            {/* Problem Section */}
            <section className="rounded-xl border border-border bg-[#111111]/30 p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <ShieldAlert className="h-5 w-5" />
                <h2 className="text-lg font-bold text-white">The Problem</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When an AI agent sends a wrong email, writes bad data to a database, or approves a fraudulent transaction — nobody finds out until after the damage is done. Current solutions are either non-existent or require teams to build fragile custom validation logic from scratch. Axon provides a universal, plug-and-play validation layer that any agent can use with two lines of code.
              </p>
            </section>

            {/* Contact Section */}
            <section className="rounded-xl border border-border bg-[#111111]/30 p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <Mail className="h-5 w-5" />
                <h2 className="text-lg font-bold text-white">Get in Touch</h2>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Have questions, feedback, or want to learn more about integrating Axon into your enterprise systems?
                </p>
                <div className="pt-2">
                  <a
                    href="mailto:axonapiai@gmail.com"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary hover:bg-muted px-4 py-2.5 text-xs font-semibold text-[#22c55e] hover:text-[#22c55e]/90 transition-colors"
                  >
                    axonapiai@gmail.com
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
