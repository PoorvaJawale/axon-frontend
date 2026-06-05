"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Copy, Check } from "lucide-react";

const actionTypes = [
  {
    type: "email",
    description: "Validates email content before sending",
    useCase: "Prevent phishing, spam, or inappropriate emails from being sent by AI agents",
  },
  {
    type: "database",
    description: "Validates database queries and operations",
    useCase: "Block destructive queries like DROP TABLE or unauthorized data access",
  },
  {
    type: "payment",
    description: "Validates payment and financial operations",
    useCase: "Prevent unauthorized transactions or suspicious payment amounts",
  },
  {
    type: "chat",
    description: "Validates chatbot responses to users",
    useCase: "Filter harmful, biased, or off-brand responses before delivery",
  },
  {
    type: "api_call",
    description: "Validates external API calls",
    useCase: "Ensure API requests don&apos;t expose sensitive data or call unauthorized endpoints",
  },
];

const pythonCode = `import requests

response = requests.post(
    "https://api.axon.ai/v1/validate",
    headers={
        "Authorization": "Bearer sk-axon-YOUR_KEY",
        "Content-Type": "application/json"
    },
    json={
        "action_type": "email",
        "output": "Dear customer, your order has been shipped.",
        "agent_id": "support-agent-01",
        "execution_endpoint": "https://your-system.com/send-email",
        "metadata": {
            "destination": "customer@example.com"
        }
    }
)

result = response.json()
if result["status"] == "PASS":
    # Proceed with execution
    print("Validation passed!")
else:
    # Handle blocked output
    print(f"Blocked: {result['reason']}")`;

const javascriptCode = `const response = await fetch("https://api.axon.ai/v1/validate", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-axon-YOUR_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    action_type: "database",
    output: "SELECT * FROM users WHERE id = 123",
    agent_id: "db-agent-01",
    execution_endpoint: "https://your-system.com/execute-query",
    metadata: {
      destination: "postgres-main"
    }
  })
});

const result = await response.json();

if (result.status === "PASS") {
  // Proceed with execution
  console.log("Validation passed!");
} else {
  // Handle blocked output
  console.log(\`Blocked: \${result.reason}\`);
}`;

const n8nCode = `// HTTP Request Node Configuration
{
  "method": "POST",
  "url": "https://api.axon.ai/v1/validate",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "options": {
    "headers": {
      "Content-Type": "application/json"
    }
  },
  "body": {
    "action_type": "{{ $json.action_type }}",
    "output": "{{ $json.agent_output }}",
    "agent_id": "n8n-workflow-agent",
    "execution_endpoint": "{{ $json.target_url }}",
    "metadata": {
      "destination": "{{ $json.destination }}"
    }
  }
}

// Then use IF node to check:
// {{ $json.status }} === "PASS"`;

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border/50 bg-muted/30 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-primary" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-b-lg border border-border/50 bg-background/50 p-4">
        <code className="text-sm text-muted-foreground">{code}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<"python" | "javascript" | "n8n">("python");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <Image
              src="/axon-logo.png"
              alt="Axon"
              width={100}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            v1.0
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Title */}
        <div className="mb-16">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">Quick Start</h1>
          <p className="text-lg text-muted-foreground">
            Learn how to integrate Axon into your AI agents in minutes.
          </p>
        </div>

        {/* Authentication */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Authentication</h2>
          <p className="mb-6 text-muted-foreground">
            All API requests require authentication using a Bearer token. Include your API key in the Authorization header:
          </p>
          <CodeBlock code="Authorization: Bearer sk-axon-YOUR_KEY" language="HTTP Header" />
        </section>

        {/* Request Format */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Request Format</h2>
          <p className="mb-6 text-muted-foreground">
            Send a POST request to <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-primary">/v1/validate</code> with the following JSON body:
          </p>
          <CodeBlock
            code={`{
  "action_type": "email | database | payment | chat | api_call",
  "output": "the agent output string or JSON to validate",
  "agent_id": "your_agent_identifier",
  "execution_endpoint": "https://your-system.com/execute",
  "metadata": {
    "destination": "where this output is going"
  }
}`}
            language="JSON"
          />
        </section>

        {/* Response Examples */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Response Examples</h2>
          <p className="mb-6 text-muted-foreground">
            Axon returns a validation result indicating whether the output is safe to execute.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-medium text-foreground">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  ✓
                </span>
                PASS Response
              </h3>
              <CodeBlock
                code={`{
  "status": "PASS",
  "confidence": 0.99,
  "message": "Validation successful"
}`}
                language="JSON"
              />
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-medium text-foreground">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400">
                  ✕
                </span>
                BLOCK Response
              </h3>
              <CodeBlock
                code={`{
  "status": "BLOCK",
  "reason": "Unsafe database operation detected"
}`}
                language="JSON"
              />
            </div>
          </div>
        </section>

        {/* Action Types Table */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Action Types</h2>
          <p className="mb-6 text-muted-foreground">
            Specify the type of action your agent is attempting to validate:
          </p>

          <div className="overflow-hidden rounded-lg border border-border/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Use Case</th>
                </tr>
              </thead>
              <tbody>
                {actionTypes.map((action, index) => (
                  <tr
                    key={action.type}
                    className={index !== actionTypes.length - 1 ? "border-b border-border/50" : ""}
                  >
                    <td className="px-4 py-3">
                      <code className="rounded bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
                        {action.type}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{action.description}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{action.useCase}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Code Examples */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Code Examples</h2>
          <p className="mb-6 text-muted-foreground">
            Here are complete integration examples for popular languages and platforms:
          </p>

          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
            {(["python", "javascript", "n8n"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "python" ? "Python" : tab === "javascript" ? "JavaScript" : "n8n"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "python" && <CodeBlock code={pythonCode} language="Python" />}
          {activeTab === "javascript" && <CodeBlock code={javascriptCode} language="JavaScript" />}
          {activeTab === "n8n" && <CodeBlock code={n8nCode} language="n8n (HTTP Request Node)" />}
        </section>

        {/* CTA */}
        <section className="rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 to-transparent p-8 text-center">
          <h2 className="mb-3 text-2xl font-semibold text-foreground">Ready to get started?</h2>
          <p className="mb-6 text-muted-foreground">
            Create your free account and get your API key in seconds.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get Your API Key
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-4xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Axon. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
