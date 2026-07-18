"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/app/context/AuthContext";
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Code,
  Shield,
} from "lucide-react";

const fetcher = (url: string, token: string | null) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
  }).then((res) => res.json());

export default function ApiKeysPage() {
  const { userApiKey, userPlan, regenerateKey } = useAuth();

  // Dynamic usage stats fetch
  const { data: usageData } = useSWR(
    userApiKey ? `/webhook/usage` : null,
    (url: string) => fetch(url).then((res) => res.json())
  );

  const monthlyRequests = usageData?.monthly_requests ?? 0;
  const requestLimit = usageData?.request_limit ?? 1000;
  const expiresAt = usageData?.expires_at
    ? new Date(usageData.expires_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const [copiedKey, setCopiedKey] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  
  // Generating key states
  const [isGenerating, setIsGenerating] = useState(false);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [copiedNewKey, setCopiedNewKey] = useState(false);

  const handleCopyCurrentKey = () => {
    if (!userApiKey) return;
    navigator.clipboard.writeText(userApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyNewKey = () => {
    if (!newGeneratedKey) return;
    navigator.clipboard.writeText(newGeneratedKey);
    setCopiedNewKey(true);
    setTimeout(() => setCopiedNewKey(false), 2000);
  };

  const handleConfirmRegenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/webhook/create-api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      });

      if (response.ok) {
        const data = await response.json();
        // Set the new generated key in state
        setNewGeneratedKey(data.apiKey);
        // Update the key in AuthContext
        regenerateKey(data.apiKey);

        setIsRegenerateModalOpen(false);
        setIsNewKeyModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to regenerate key:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Format masked key: sk-axon-xxxxxxxx••••••••
  const formatMaskedKey = (key: string | null) => {
    if (!key) return "sk-axon-••••••••••••••••";
    // sk-axon- is 8 chars, we show 8 more characters, and then mask
    const prefix = key.substring(0, 16);
    return `${prefix}••••••••`;
  };

  return (
    <div className="space-y-8 text-white relative">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">API Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage access credentials for integrating Axon validation middleware with your AI agents
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: API Key details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* YOUR API KEY card */}
          <div className="rounded-xl border border-border/50 bg-[#111111]/30 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Shield className="h-4.5 w-4.5 text-primary" />
                YOUR API KEY
              </div>
              <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                Active
              </span>
            </div>

            {/* Key Field with Copy */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Active API Key
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 font-mono text-sm bg-[#0c0c0c] border border-border/80 px-4 py-3 rounded-lg text-muted-foreground select-none">
                  {formatMaskedKey(userApiKey)}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCurrentKey}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary hover:bg-muted px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-white transition-colors cursor-pointer"
                    title="Copy API Key"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="h-4 w-4 text-primary" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setIsRegenerateModalOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-4 py-3 text-xs font-semibold text-red-400 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Key
                  </button>
                </div>
              </div>
            </div>

            {/* Key Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/30 text-xs">
              <div>
                <p className="text-muted-foreground">Plan</p>
                <p className="mt-1 font-semibold text-white">{userPlan}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="mt-1 font-semibold text-white">—</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expires</p>
                <p className="mt-1 font-semibold text-white">{expiresAt}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Monthly usage</p>
                <p className="mt-1 font-semibold text-white">
                  {monthlyRequests.toLocaleString()} / {requestLimit === 10000000 ? "Unlimited" : requestLimit.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Start Integration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-border/50 bg-[#111111]/30 p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Code className="h-4.5 w-4.5 text-primary" />
              Quick Integration
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Axon validates agent outputs via standard HTTP header validation. Send your secret token inside the <code className="text-primary font-mono">Authorization</code> field.
            </p>

            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                API HEADER REQUEST
              </span>
              <div className="overflow-hidden rounded-lg border border-border/80 bg-[#0a0a0a] font-mono text-[11px] p-4 text-purple-400 relative">
                <div className="text-foreground">
                  <span className="text-purple-400">Authorization:</span>{" "}
                  <span className="text-emerald-400">Bearer sk-axon-YOUR_KEY</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/30 text-xs space-y-2">
              <div className="flex gap-2.5 items-start">
                <span className="rounded-full bg-primary/10 text-primary h-5 w-5 flex items-center justify-center shrink-0 text-[10px] font-semibold">1</span>
                <span className="text-muted-foreground">Copy your active API key.</span>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="rounded-full bg-primary/10 text-primary h-5 w-5 flex items-center justify-center shrink-0 text-[10px] font-semibold">2</span>
                <span className="text-muted-foreground">Add validation middleware hooks inside your agent execution flow.</span>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="rounded-full bg-primary/10 text-primary h-5 w-5 flex items-center justify-center shrink-0 text-[10px] font-semibold">3</span>
                <span className="text-muted-foreground">Inspect response blocks in the Logs panel.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Regenerate Key Confirmation */}
      {isRegenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-[440px] rounded-xl border border-border bg-[#111111] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-red-400">
              <div className="rounded-lg bg-red-500/10 p-2 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Regenerate API Key?</h3>
            </div>
            
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your current key will be permanently invalidated. Any agents using it will stop working immediately. This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsRegenerateModalOpen(false)}
                className="rounded-lg border border-border bg-transparent hover:bg-muted text-xs font-semibold px-4 py-2 text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRegenerate}
                disabled={isGenerating}
                className="rounded-lg bg-red-500 hover:bg-red-600 text-black text-xs font-semibold px-4 py-2 transition-colors cursor-pointer"
              >
                {isGenerating ? "Regenerating..." : "Yes, Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Success Modal (Show Once) */}
      {isNewKeyModalOpen && newGeneratedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-[500px] rounded-xl border border-[#22c55e]/20 bg-[#111111] p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center gap-3 text-primary">
              <div className="rounded-lg bg-primary/10 p-2 border border-[#22c55e]/20">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">New API Key Generated</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Save this key now. It will not be shown again.
            </p>

            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                NEW SECRET API KEY
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-xs bg-[#0c0c0c] border border-border px-3.5 py-2.5 rounded-lg text-white select-all">
                  {newGeneratedKey}
                </div>
                <button
                  onClick={handleCopyNewKey}
                  className="rounded-lg border border-border bg-secondary hover:bg-muted p-2.5 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                  title="Copy New Key"
                >
                  {copiedNewKey ? <Check className="h-4.5 w-4.5 text-primary" /> : <Copy className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Warning Text in Yellow */}
            <div className="text-xs font-semibold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
              Warning: This key will only be shown once
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => {
                  setIsNewKeyModalOpen(false);
                  setNewGeneratedKey(null);
                }}
                className="rounded-lg bg-primary text-black hover:bg-primary/90 text-xs font-semibold px-5 py-2 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
