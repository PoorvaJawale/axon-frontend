import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, Plus } from "lucide-react";
import { PageFrame } from "@/components/public/page-frame";
export const metadata: Metadata = { title: "Changelog | Axon", description: "Releases and improvements to Axon." };
const changelogEntries = [
  {
    version: "v1.0.0",
    date: "June 2026",
    badge: "Latest",
    title: "Public Beta Launch",
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
    title: "Beta Infrastructure",
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
    title: "Alpha Release",
    changes: [
      "Initial validation pipeline",
      "Basic schema checking with Pydantic",
      "First version of judge model integration",
      "Webhook-based API design",
    ],
  },
];


export default function ChangelogPage() {
 return <PageFrame active="Changelog" title="Every change. In the open." description="Follow Axon from its first validation pipeline to public beta.">
  <div className="ap-archive-layout"><aside className="ap-archive-index" aria-label="Release index"><h2>Release archive</h2>{changelogEntries.map(entry => <a key={entry.version} href={"#" + entry.version}><span>{entry.version}</span><ArrowDown size={14}/></a>)}<Link href="/docs" className="ap-text-link">Read the docs ↗</Link></aside>
  <div className="ap-releases">{changelogEntries.map((entry, index) => <details key={entry.version} id={entry.version} open={index === 0} className="ap-release">
    <summary><div className="ap-release-date"><span className="ap-version">{entry.version}</span><span>{entry.date}</span></div><div className="ap-release-title"><span className={"ap-tag " + (index === 0 ? "ap-tag-green" : "")}>{entry.badge}</span><h2>{entry.title}</h2><span className="ap-meta">{entry.changes.length} updates</span></div><Plus className="ap-disclosure" size={20}/></summary>
    <ul>{entry.changes.map(change => <li key={change}>{change}</li>)}</ul>
  </details>)}</div></div>
 </PageFrame>;
}
