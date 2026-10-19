import type { Metadata } from "next";
import { PageFrame } from "@/components/public/page-frame";
import { BlogFeed } from "@/components/public/blog-feed";
export const metadata: Metadata = { title: "Blog | Axon", description: "Notes on AI safety, agent architecture, and production reliability." };
export default function BlogPage() { return <PageFrame active="Blog" title="Ideas for agents in the real world." description="Notes on AI safety, agent architecture, and production reliability."><BlogFeed /></PageFrame>; }
