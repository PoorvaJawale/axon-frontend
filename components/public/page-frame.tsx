import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./public-pages.css";

const pages = [["About", "/about"], ["Blog", "/blog"], ["Changelog", "/changelog"], ["Status", "/status"]];
export function PageFrame({ active, title, description, children, article = false }: { active: string; title: string; description?: string; children: ReactNode; article?: boolean }) {
  return <div className="axon-public">
    <a className="ap-skip" href="#public-content">Skip to content</a>
    <Header />
    <div className="ap-subnav"><Link href={article ? "/blog" : "/"} className="ap-back"><ArrowLeft size={14} />{article ? "All articles" : "Home"}</Link>
      <nav aria-label="Company">{pages.map(([label, href]) => <Link key={href} href={href} aria-current={active === label ? "page" : undefined}>{label}</Link>)}</nav>
    </div>
    <main id="public-content" className={article ? "ap-main ap-article-main" : "ap-main"} tabIndex={-1}>
      <header className="ap-heading"><h1>{title}</h1>{description && <p>{description}</p>}</header>
      {children}
    </main>
    <Footer />
  </div>;
}
export function ContactLink({ children = "Talk to the team" }: { children?: ReactNode }) {
  return <a className="ap-action" href="mailto:axonapiai@gmail.com">{children}<ArrowUpRight size={16} aria-hidden="true" /></a>;
}
