"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
const posts = [
 {slug:"why-agents-fail",date:"June 5, 2026",tag:"Technical",title:"Why AI agents fail silently in production",preview:"Agents that look fine in testing can break quietly in production. Explore why it happens — and where validation fits."},
 {slug:"introducing-axon",date:"May 28, 2026",tag:"Product",title:"Introducing Axon: The validation layer for AI agents",preview:"Meet Axon in public beta: a validation layer between your AI agents and the systems they act on."}
];
export function BlogFeed() {
 const [filter, setFilter] = useState("All");
 const visible = posts.filter(post => filter === "All" || post.tag === filter);
 return <><div className="ap-feed-toolbar"><div className="ap-switch" role="group" aria-label="Filter articles">{["All", "Technical", "Product"].map(category => <button type="button" key={category} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}</div><span className="ap-meta" role="status">{visible.length} {visible.length === 1 ? "article" : "articles"}</span></div>
 <div className="ap-posts">{visible.map(post => <article key={post.slug} className={"ap-post " + (post.tag === "Technical" ? "ap-post-featured" : "")}><div className="ap-post-copy"><div className="ap-post-meta"><span className={"ap-tag " + (post.tag === "Technical" ? "ap-tag-green" : "ap-tag-purple")}>{post.tag}</span><time dateTime={post.slug === "why-agents-fail" ? "2026-06-05" : "2026-05-28"}>{post.date}</time></div><h2><Link href={"/blog/" + post.slug}>{post.title}</Link></h2><p>{post.preview}</p><Link className="ap-text-link" href={"/blog/" + post.slug}>Read article<ArrowUpRight size={16}/><span className="ap-sr-only">: {post.title}</span></Link></div>
 {post.tag === "Technical" && <div className="ap-story-visual" aria-hidden="true"><div className="ap-visual-line"><span>Agent output</span><span>01</span></div><div className="ap-visual-branch"><span>Valid JSON</span><span className="ap-visual-warning">Wrong intent</span></div><div className="ap-visual-line ap-visual-gate"><span>Validation boundary</span><span>↓</span></div><div className="ap-visual-end">Catch the quiet failure.</div></div>}</article>)}</div></>;
}
