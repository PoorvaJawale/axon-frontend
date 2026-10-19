import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame, ContactLink } from "@/components/public/page-frame";
import { ValidationJourney } from "@/components/public/validation-journey";
export const metadata: Metadata = { title: "About Axon", description: "The validation layer between AI agents and the systems they act on." };
export default function AboutPage() {
  return <PageFrame active="About" title="Confidence before execution." description="We’re building the trust layer between AI agents and the real world.">
    <div className="ap-about-grid">
      <div className="ap-mission"><h2>AI moves fast. <br/>Trust needs a checkpoint.</h2><p>AI agents are reaching production faster than safety infrastructure can keep up. Axon exists to close that gap.</p><p>Our mission is to help developers ship with confidence by checking agent outputs before they reach an email inbox, a database, or a payment system.</p><Link className="ap-action" href="/docs">Explore the documentation <span aria-hidden="true">↗</span></Link></div>
      <ValidationJourney />
    </div>
    <section className="ap-editorial-section"><h2>The problem we’re solving</h2><div><p>When an agent sends the wrong email, writes bad data, or approves a fraudulent transaction, the damage can happen before anyone notices.</p><p>Teams often build fragile custom validation logic to catch those mistakes. Axon brings schema and semantic checks into a shared validation layer, so developers can focus on the products they’re building.</p></div></section>
    <section className="ap-contact"><div><h2>Build with us.</h2><p>Questions, feedback, or an enterprise integration in mind?</p></div><ContactLink /></section>
  </PageFrame>;
}
