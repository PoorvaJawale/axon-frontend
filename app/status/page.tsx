import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageFrame, ContactLink } from "@/components/public/page-frame";
import { ServiceHealth } from "@/components/public/service-health";
export const metadata: Metadata = { title: "System status | Axon", description: "Service monitoring availability and published incident history." };
export default function StatusPage() {
 return <PageFrame active="Status" title="System status" description="Service health and published incident history.">
  <ServiceHealth />
  <aside className="ap-contact"><div><h2>Having trouble?</h2><p>Send the team the affected service and time of the problem.</p></div><ContactLink>Report an issue</ContactLink></aside>
  <section className="ap-incidents"><div className="ap-section-heading"><h2>Incident archive</h2><span className="ap-meta">Published history</span></div><details className="ap-incident"><summary><span className="ap-tag ap-tag-green">Resolved</span><div><h3>Elevated latency on semantic judge</h3><span className="ap-meta">June 1, 2026 · 12 minutes</span></div><Plus className="ap-disclosure" size={20}/></summary><p>Brief latency spike on the semantic validation layer lasting 12 minutes. Root cause identified and resolved. No validations were incorrectly passed.</p></details></section>
 </PageFrame>;
}
