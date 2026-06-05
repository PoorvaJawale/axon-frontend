"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

const codeExample = `const response = await fetch("https://api.validai.dev/validate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your_api_key"
  },
  body: JSON.stringify({
    schema: "user_profile",
    data: aiAgentResponse
  })
});

const result = await response.json();
// { valid: true, sanitized: {...}, warnings: [] }`;

export function CodeSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Integrate in minutes
            </h2>
            <p className="mb-6 text-lg text-muted-foreground">
              A simple API call is all it takes to validate your AI outputs.
              Works with any language or framework.
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs text-primary">
                  1
                </span>
                Define your validation schemas
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs text-primary">
                  2
                </span>
                Send AI outputs through our API
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs text-primary">
                  3
                </span>
                Receive validated, sanitized data
              </li>
            </ul>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  validate.ts
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
                <code className="text-muted-foreground">
                  {codeExample.split("\n").map((line, i) => (
                    <span key={i} className="block">
                      <span className="mr-4 inline-block w-6 select-none text-right text-muted-foreground/50">
                        {i + 1}
                      </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlightSyntax(line),
                        }}
                      />
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function highlightSyntax(line: string): string {
  return line
    .replace(
      /(const|await|method|headers|body)/g,
      '<span class="text-purple-400">$1</span>'
    )
    .replace(
      /(".*?")/g,
      '<span class="text-emerald-400">$1</span>'
    )
    .replace(
      /(fetch|JSON\.stringify)/g,
      '<span class="text-yellow-400">$1</span>'
    )
    .replace(
      /(\/\/.*$)/g,
      '<span class="text-muted-foreground/60">$1</span>'
    );
}
