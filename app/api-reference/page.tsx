"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Copy, Check, Terminal, ChevronRight, ArrowLeft } from "lucide-react";

// Code examples definitions
const authCode = `Authorization: Bearer sk-axon-YOUR_KEY`;

const validateRequestHeaders = `Authorization: Bearer sk-axon-YOUR_KEY
Content-Type: application/json`;

const validateRequestBody = `{
  "action_type": "email",
  "output": "your agent output here",
  "agent_id": "agent_001",
  "execution_endpoint": "https://your-system.com/execute",
  "metadata": {
    "destination": "user@example.com"
  }
}`;

const validateResponsePass = `{
  "status": "PASS",
  "validated": true,
  "reason": null
}`;

const validateResponseBlock = `{
  "status": "BLOCK",
  "validated": false,
  "reason": "Agent promised non-existent refund policy"
}`;

const getLogsResponse = `[
  {
    "id": 1,
    "agent_id": "agent_001",
    "action_type": "email",
    "final_verdict": "PASS",
    "reason": null,
    "timestamp": "2026-06-07T14:32:01Z"
  }
]`;

const getUsageResponse = `{
  "monthly_requests": 4821,
  "request_limit": 50000,
  "plan": "pro"
}`;

const createKeyRequest = `{
  "user_name": "your_username",
  "plan": "free",
  "name": "My API Key"
}`;

const createKeyResponse = `{
  "api_key": "sk-axon-xxxxxxxxxxxxxxxxxx",
  "message": "Save this key now. It will not be shown again."
}`;

const sections = [
  { id: "authentication", label: "Authentication" },
  { id: "validate-output", label: "Validate Output" },
  { id: "get-logs", label: "Get Logs" },
  { id: "get-alerts", label: "Get Alerts" },
  { id: "get-usage", label: "Get Usage" },
  { id: "create-api-key", label: "Create API Key" },
  { id: "error-codes", label: "Error Codes" },
];

const errorCodes = [
  {
    code: "401",
    meaning: "Invalid or missing API key",
    fix: "Check your Authorization header",
  },
  {
    code: "429",
    meaning: "Rate limit exceeded",
    fix: "Upgrade your plan or wait for monthly reset",
  },
  {
    code: "400",
    meaning: "Invalid request format",
    fix: "Check your request body matches the schema",
  },
  {
    code: "500",
    meaning: "Internal server error",
    fix: "Contact axonapiai@gmail.com",
  },
];

export default function ApiReferencePage() {
  const [activeSection, setActiveSection] = useState("authentication");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;

      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 110;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <main className="flex-1 pt-12 pb-16 px-6 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#37e39b]/3 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-6xl">
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors mb-6 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          {/* Reference Header */}
          <div className="mb-12 border-b border-border/50 pb-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              <Terminal className="h-4 w-4" />
              API Docs
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              API Reference
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete reference for the Axon REST API. Authenticate your agent outputs to secure your production environments.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-12 pt-4">
            {/* Sticky Left Navigation */}
            <aside className="lg:w-60 shrink-0 lg:sticky lg:top-28 h-fit">
              <nav className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
                  API Endpoints
                </p>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                      activeSection === section.id
                        ? "bg-primary/10 text-primary border-l-2 border-primary pl-4"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground pl-3"
                    }`}
                  >
                    <span>{section.label}</span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 opacity-0 transition-opacity ${
                        activeSection === section.id ? "opacity-100" : ""
                      }`}
                    />
                  </button>
                ))}
              </nav>
            </aside>

            {/* Reference Content */}
            <main className="flex-1 min-w-0 space-y-16">
              {/* Authentication Section */}
              <section id="authentication" className="scroll-mt-28 space-y-4">
                <h2 className="text-lg font-bold text-white">Authentication</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All requests require a Bearer token inside the Authorization header. Make sure to keep your secret API key secure and execute your integrations over HTTPS.
                </p>
                <CodeBlock code={authCode} language="headers" filename="Headers" />
              </section>

              {/* Validate Output Section */}
              <section id="validate-output" className="scroll-mt-28 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Validate Output</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary font-mono">
                      POST
                    </span>
                    <code className="text-xs font-mono text-muted-foreground select-all bg-[#070908] px-2 py-0.5 rounded border border-border">
                      /webhook/validate-agent-output
                    </code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Validates an AI agent output before execution. Returns a PASS verdict to execute or a BLOCK verdict detailing the safety filter trigger.
                </p>

                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Request Headers
                  </span>
                  <CodeBlock code={validateRequestHeaders} language="headers" filename="Headers" />
                </div>

                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Request Body
                  </span>
                  <CodeBlock code={validateRequestBody} language="json" filename="Payload (JSON)" />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                      PASS Response
                    </span>
                    <CodeBlock code={validateResponsePass} language="json" filename="Success" />
                  </div>
                  <div className="space-y-2">
                    <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                      BLOCK Response
                    </span>
                    <CodeBlock code={validateResponseBlock} language="json" filename="Blocked" />
                  </div>
                </div>
              </section>

              {/* Get Logs Section */}
              <section id="get-logs" className="scroll-mt-28 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Get Logs</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="rounded bg-[#070908] border border-border px-2 py-0.5 text-[10px] font-bold text-white font-mono">
                      GET
                    </span>
                    <code className="text-xs font-mono text-muted-foreground select-all bg-[#070908] px-2 py-0.5 rounded border border-border">
                      /webhook/logs
                    </code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Returns paginated validation logs for the authenticated developer account. Supports query parameters <code className="text-primary font-mono text-[10px]">page</code> (default 1) and <code className="text-primary font-mono text-[10px]">limit</code> (default 50).
                </p>
                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Response JSON
                  </span>
                  <CodeBlock code={getLogsResponse} language="json" filename="Logs List (JSON)" />
                </div>
              </section>

              {/* Get Alerts Section */}
              <section id="get-alerts" className="scroll-mt-28 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Get Alerts</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="rounded bg-[#070908] border border-border px-2 py-0.5 text-[10px] font-bold text-white font-mono">
                      GET
                    </span>
                    <code className="text-xs font-mono text-muted-foreground select-all bg-[#070908] px-2 py-0.5 rounded border border-border">
                      /webhook/alerts
                    </code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Returns all validation events flagged as <code className="text-red-400 font-mono text-[10px]">BLOCK</code> verdicts for the authenticated account, enabling compliance reviews.
                </p>
              </section>

              {/* Get Usage Section */}
              <section id="get-usage" className="scroll-mt-28 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Get Usage</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="rounded bg-[#070908] border border-border px-2 py-0.5 text-[10px] font-bold text-white font-mono">
                      GET
                    </span>
                    <code className="text-xs font-mono text-muted-foreground select-all bg-[#070908] px-2 py-0.5 rounded border border-border">
                      /webhook/usage
                    </code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Returns the validation volume requests consumed within the current billing month alongside active plan limitations.
                </p>
                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Response JSON
                  </span>
                  <CodeBlock code={getUsageResponse} language="json" filename="Usage Payload (JSON)" />
                </div>
              </section>

              {/* Create API Key Section */}
              <section id="create-api-key" className="scroll-mt-28 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Create API Key</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary font-mono">
                      POST
                    </span>
                    <code className="text-xs font-mono text-muted-foreground select-all bg-[#070908] px-2 py-0.5 rounded border border-border">
                      /webhook/create-api-key
                    </code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generates a new API integration credential. <strong>Note:</strong> The newly created key is returned inside the response payload only once. Save it securely.
                </p>

                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Request Body
                  </span>
                  <CodeBlock code={createKeyRequest} language="json" filename="Payload (JSON)" />
                </div>

                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Response JSON
                  </span>
                  <CodeBlock code={createKeyResponse} language="json" filename="Key Generated (JSON)" />
                </div>
              </section>

              {/* Error Codes Section */}
              <section id="error-codes" className="scroll-mt-28 space-y-4">
                <h2 className="text-lg font-bold text-white">Error Codes</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Axon API triggers HTTP error status indicators alongside payload messages if requests cannot be validated successfully.
                </p>

                <div className="overflow-hidden rounded-xl border border-border/50 bg-[#0a0d0c]/30 backdrop-blur-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/20">
                          <th className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground">
                            Code
                          </th>
                          <th className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground">
                            Meaning
                          </th>
                          <th className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground">
                            How to fix
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {errorCodes.map((err) => (
                          <tr key={err.code} className="transition-colors hover:bg-muted/5">
                            <td className="px-6 py-4 font-mono font-bold text-primary whitespace-nowrap">
                              {err.code}
                            </td>
                            <td className="px-6 py-4 text-foreground font-medium max-w-xs">
                              {err.meaning}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground max-w-sm">
                              {err.fix}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </main>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Reusable CodeBlock component
interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-inner relative group/block">
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        {filename && (
          <span className="font-mono text-[10px] text-muted-foreground font-semibold select-none uppercase tracking-wider">
            {filename}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-border/50 bg-[#0a0d0c] px-2 py-1 text-xs text-muted-foreground transition-all hover:bg-muted hover:text-foreground cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-primary" />
              <span className="text-primary font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed bg-[#070908]">
        <code className="text-muted-foreground block">
          {code.split("\n").map((line, i) => (
            <span key={i} className="block min-h-[1.5rem] hover:bg-muted/5 rounded px-1 -mx-1 transition-colors">
              <span className="mr-4 inline-block w-6 select-none text-right text-muted-foreground/35 font-medium">
                {i + 1}
              </span>
              <HighlightedLine line={line} language={language} />
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

// Light token highlighter
function HighlightedLine({ line, language }: { line: string; language?: string }) {
  if (!language) return <span>{line}</span>;

  const tokens: { text: string; className: string }[] = [];

  if (language === "json") {
    const regex = /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(\b\d+(?:\.\d+)?\b)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({
          text: line.slice(lastIndex, match.index),
          className: "",
        });
      }

      if (match[1]) {
        tokens.push({ text: match[1], className: "text-purple-400 font-semibold" });
        tokens.push({ text: match[2], className: "text-foreground" });
      } else if (match[3]) {
        tokens.push({ text: match[3], className: "text-emerald-400" });
      } else if (match[4]) {
        tokens.push({ text: match[4], className: "text-orange-400" });
      } else if (match[5]) {
        tokens.push({ text: match[5], className: "text-blue-400" });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      tokens.push({ text: line.slice(lastIndex), className: "" });
    }
  } else if (language === "headers") {
    const regex = /^([^:]+):(.*)$/;
    const match = regex.exec(line);
    if (match) {
      return (
        <span>
          <span className="text-purple-400 font-semibold">{match[1]}:</span>
          <span className="text-emerald-400">{match[2]}</span>
        </span>
      );
    }
    return <span>{line}</span>;
  } else {
    return <span>{line}</span>;
  }

  return (
    <span>
      {tokens.map((token, i) => (
        <span key={i} className={token.className}>
          {token.text}
        </span>
      ))}
    </span>
  );
}
