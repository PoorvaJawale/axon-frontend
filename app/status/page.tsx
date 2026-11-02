import type { Metadata } from "next";
import { PageFrame, ContactLink } from "@/components/public/page-frame";
import { ServiceHealth } from "@/components/public/service-health";
export const metadata: Metadata = { title: "System status | Axon", description: "Service monitoring availability and published incident history." };
export default function StatusPage() {
 return <PageFrame active="Status" title="System status" description="Service health and published incident history.">
  <ServiceHealth />
  <aside className="ap-contact"><div><h2>Having trouble?</h2><p>Send the team the affected service and time of the problem.</p></div><ContactLink>Report an issue</ContactLink></aside>
  <section className="ap-incidents" aria-labelledby="incidents-title"><div className="ap-section-heading"><h2 id="incidents-title">Incident archive</h2><span className="ap-meta">Published history</span></div><p>No incident reports have been published here. This archive is maintained by the team; current check results appear above.</p></section>
 </PageFrame>;
}
