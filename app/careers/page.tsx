"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ArrowLeft, Briefcase, Mail } from "lucide-react";

export default function CareersPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-32 pb-24 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#37e39b]/5 blur-[100px]" />
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
              Careers
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Join us in building the safety layer for AI agents.
            </p>
          </div>

          <div className="space-y-8">
            {/* Intro Copy */}
            <div className="rounded-xl border border-border bg-[#0a0d0c]/30 p-6 md:p-8 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Axon is an early stage product built by a small team. We are not hiring formally yet, but we are always interested in talking to exceptional people who care about AI safety and production reliability.
              </p>
            </div>

            {/* Position Card */}
            <div className="rounded-xl border border-dashed border-border bg-[#0a0d0c]/10 p-8 text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-lg bg-secondary border border-border/80 flex items-center justify-center text-muted-foreground">
                <Briefcase className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  No open positions right now
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  We are heads down building the product. Check back soon or reach out directly to say hello.
                </p>
              </div>
              <div className="pt-3">
                <a
                  href="mailto:axonapiai@gmail.com"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#37e39b] px-5 py-2.5 text-xs font-semibold text-[#000000] hover:bg-[#37e39b]/90 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Say Hello
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
