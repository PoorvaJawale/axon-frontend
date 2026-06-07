"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ArrowLeft, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

const services = [
  { name: "Validation API", status: "Operational", uptime: "99.9%", color: "text-[#22c55e]" },
  { name: "Schema Validator", status: "Operational", uptime: "99.9%", color: "text-[#22c55e]" },
  { name: "Semantic Judge", status: "Operational", uptime: "99.8%", color: "text-[#22c55e]" },
  { name: "Dashboard", status: "Operational", uptime: "99.9%", color: "text-[#22c55e]" },
  { name: "Database", status: "Operational", uptime: "99.9%", color: "text-[#22c55e]" },
  { name: "Background Validator", status: "Operational", uptime: "99.7%", color: "text-[#22c55e]" },
];

const incidents = [
  {
    date: "June 1, 2026",
    title: "Elevated latency on semantic judge",
    status: "Resolved",
    description: "Brief latency spike on the semantic validation layer lasting 12 minutes. Root cause identified and resolved.",
    severity: "low",
  },
];

export default function StatusPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-32 pb-24 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#22c55e]/5 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-4xl space-y-8">
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
              System Status
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Real-time status of Axon services and incident logs.
            </p>
          </div>

          {/* Operational Banner */}
          <div className="rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 p-5 flex items-center gap-4">
            <CheckCircle2 className="h-6 w-6 text-[#22c55e] shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#22c55e] uppercase tracking-wider">
                All Systems Operational
              </p>
              <p className="text-xs text-emerald-400/80 mt-0.5">
                All validation middleware services are performing normally.
              </p>
            </div>
          </div>

          {/* Services Table */}
          <div className="rounded-xl border border-border bg-[#111111]/30 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground">
                      Service Name
                    </th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground">
                      Uptime
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {services.map((svc) => (
                    <tr key={svc.name} className="transition-colors hover:bg-muted/5">
                      <td className="px-6 py-4 font-semibold text-white">
                        {svc.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse" />
                          {svc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">
                        {svc.uptime}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Incident History */}
          <div className="space-y-4 pt-6 border-t border-border/30">
            <h2 className="text-lg font-bold text-white">Past Incidents</h2>
            
            <div className="space-y-4">
              {incidents.map((incident, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-[#111111]/20 p-5 space-y-3 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {incident.date}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-border" />
                      <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.2 text-[9px] font-bold text-emerald-400">
                        {incident.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {incident.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {incident.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
