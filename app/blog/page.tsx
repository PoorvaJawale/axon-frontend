"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ArrowLeft, BookOpen, Calendar, ArrowRight } from "lucide-react";

const blogPosts = [
  {
    slug: "why-agents-fail",
    date: "June 5, 2026",
    tag: "Technical",
    title: "Why AI agents fail silently in production",
    preview: "Most developers building agentic systems discover the same thing the hard way — agents that look fine in testing break quietly in production. Here is why that happens and what you can do about it.",
  },
  {
    slug: "introducing-axon",
    date: "May 28, 2026",
    tag: "Product",
    title: "Introducing Axon: The validation layer for AI agents",
    preview: "Today we are launching Axon in public beta. Axon sits between your AI agents and your production systems, catching hallucinations and malformed outputs before they reach your users.",
  },
];

export default function BlogIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-32 pb-24 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-1/4 h-[400px] w-[400px] rounded-full bg-[#22c55e]/3 blur-[100px]" />
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

          <div className="mb-12 border-b border-border/50 pb-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              <BookOpen className="h-4 w-4" />
              Blog
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Axon Blog
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Insights on AI safety, agent architecture, and production reliability.
            </p>
          </div>

          {/* Grid of posts */}
          <div className="grid gap-8 md:grid-cols-2">
            {blogPosts.map((post) => (
              <div
                key={post.slug}
                className="flex flex-col justify-between rounded-xl border border-border bg-[#111111]/30 p-6 backdrop-blur-sm relative overflow-hidden transition-all duration-300 hover:border-border/80 hover:bg-[#111111]/50 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                      {post.tag}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                      <Calendar className="h-3.5 w-3.5" />
                      {post.date}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-white mb-2 leading-snug group-hover:text-[#22c55e] transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                    {post.preview}
                  </p>
                </div>

                <div className="pt-4 border-t border-border/40">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#22c55e] hover:text-[#22c55e]/80 transition-colors"
                  >
                    Read More
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
