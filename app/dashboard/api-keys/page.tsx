"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/app/context/AuthContext";
import {
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  Shield,
  Code,
} from "lucide-react";

type ApiKeyRow = {
  id: number;
  name: string;
  keyPrefix: string;
  plan: string;
  isActive: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  monthlyRequests: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function maskedKey(prefix: string): string {
  return prefix ? `${prefix}••••••••` : "sk-axon-••••••••••••";
}

export default function ApiKeysPage() {
  const { userApiKey, userPlan, regenerateKey } = useAuth();

  const { data, isLoading, mutate } = useSWR("/webhook/api-keys", fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });
  const { data: usageData } = useSWR("/webhook/usage", fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  const keys: ApiKeyRow[] = data?.keys ?? [];
  const monthlyRequests = usageData?.monthly_requests ?? 0;
  const requestLimit = usageData?.request_limit ?? 1000;

  // Which key powers this dashboard session (matched by prefix)
  const currentPrefix = userApiKey ? userApiKey.slice(0, 20) : null;

  // Create-key modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // One-time key display state
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copiedFresh, setCopiedFresh] = useState(false);

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleCreate = async () => {
    setCreateError("");
    if (!newKeyName.trim()) {
      setCreateError("Give the key a name — e.g. the project or agent using it.");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/webhook/create-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      if (created.apiKey) {
        setFreshKey(created.apiKey);
        regenerateKey(created.apiKey);
      }
      setIsCreateOpen(false);
      setNewKeyName("");
      mutate();
    } catch (err) {
      console.error("Key creation failed:", err);
      setCreateError("Could not create the key. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await fetch("/webhook/revoke-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: revokeTarget.id }),
      });
      if (res.ok) {
        setRevokeTarget(null);
        mutate();
      } else {
        alert("Could not revoke the key. Please try again.");
      }
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyFresh = () => {
    if (!freshKey) return;
    navigator.clipboard.writeText(freshKey);
    setCopiedFresh(true);
    setTimeout(() => setCopiedFresh(false), 2000);
  };

  return (
    <div className="space-y-8 text-white relative">
      {/* Page Title + Create button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a key for each project or agent. All keys share your plan's
            monthly validation quota.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary/90 text-black font-semibold text-sm px-4 py-2.5 transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create new secret key
        </button>
      </div>

      {/* Shared quota summary */}
      <div className="rounded-xl border border-border/50 bg-[#0a0d0c]/30 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 text-sm">
        <div className="flex items-center gap-2 font-semibold text-white">
          <Shield className="h-4.5 w-4.5 text-primary" />
          {userPlan} plan
        </div>
        <div className="text-muted-foreground">
          Validations used this month:{" "}
          <span className="text-white font-semibold">
            {monthlyRequests.toLocaleString()} /{" "}
            {requestLimit === 999999999
              ? "Unlimited"
              : requestLimit.toLocaleString()}
          </span>{" "}
          <span className="text-xs">(shared across all keys)</span>
        </div>
      </div>

      {/* Keys table */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-[#0a0d0c]/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Secret Key</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5">Last Used</th>
                <th className="px-6 py-3.5">Validations Used</th>
                <th className="px-6 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground text-xs">
                    Loading your keys...
                  </td>
                </tr>
              )}
              {!isLoading && keys.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground text-xs">
                    No API keys yet — create your first one to start validating.
                  </td>
                </tr>
              )}
              {keys.map((k) => {
                const isCurrent = currentPrefix !== null && k.keyPrefix === currentPrefix;
                return (
                  <tr key={k.id} className="transition-colors hover:bg-muted/10">
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {k.name}
                        {isCurrent && (
                          <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-bold text-primary">
                            CURRENT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {maskedKey(k.keyPrefix)}
                    </td>
                    <td className="px-6 py-4">
                      {k.isActive ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {formatDate(k.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {formatDate(k.lastUsedAt)}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-white">
                      {k.monthlyRequests.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {k.isActive && (
                        <button
                          onClick={() => setRevokeTarget(k)}
                          disabled={isCurrent}
                          title={
                            isCurrent
                              ? "This key powers your dashboard session — create a new key first"
                              : "Revoke this key"
                          }
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Integration helper */}
      <div className="rounded-xl border border-border/50 bg-[#0a0d0c]/30 p-6 space-y-3 max-w-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Code className="h-4.5 w-4.5 text-primary" />
          Quick Integration
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Send your secret API key inside the{" "}
          <code className="text-primary font-mono">Authorization</code> header:
        </p>
        <div className="overflow-hidden rounded-lg border border-border/80 bg-[#080b0a] font-mono text-[11px] p-4">
          <span className="text-purple-400">Authorization:</span>{" "}
          <span className="text-emerald-400">Bearer sk-axon-YOUR_KEY</span>
        </div>
      </div>

      {/* MODAL: Create key */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-[440px] rounded-xl border border-border bg-[#0a0d0c] p-6 shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-white">Create new secret key</h3>
            {createError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                {createError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Key name
              </label>
              <input
                type="text"
                autoFocus
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. support-agent-prod"
                className="w-full rounded-lg border border-border bg-[#080b0a] px-3.5 py-2 text-sm text-white placeholder-muted-foreground/50 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Name it after the project or agent that will use it.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setNewKeyName("");
                  setCreateError("");
                }}
                className="rounded-lg border border-border bg-transparent hover:bg-muted text-xs font-semibold px-4 py-2 text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="rounded-lg bg-primary hover:bg-primary/90 text-black text-xs font-semibold px-4 py-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isCreating ? "Creating..." : "Create key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: One-time key display */}
      {freshKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-[500px] rounded-xl border border-[#37e39b]/20 bg-[#0a0d0c] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-primary">
              <div className="rounded-lg bg-primary/10 p-2 border border-[#37e39b]/20">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Key created</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Save this key now. It will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-xs bg-[#080b0a] border border-border px-3.5 py-2.5 rounded-lg text-white select-all break-all">
                {freshKey}
              </div>
              <button
                onClick={handleCopyFresh}
                className="rounded-lg border border-border bg-secondary hover:bg-muted p-2.5 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                title="Copy key"
              >
                {copiedFresh ? (
                  <Check className="h-4.5 w-4.5 text-primary" />
                ) : (
                  <Copy className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
            <div className="text-xs font-semibold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
              Warning: This key will only be shown once
            </div>
            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setFreshKey(null)}
                className="rounded-lg bg-primary text-black hover:bg-primary/90 text-xs font-semibold px-5 py-2 transition-colors cursor-pointer"
              >
                I saved my key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Revoke confirmation */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-[440px] rounded-xl border border-border bg-[#0a0d0c] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-red-400">
              <div className="rounded-lg bg-red-500/10 p-2 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Revoke &quot;{revokeTarget.name}&quot;?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This key (
              <span className="font-mono">{maskedKey(revokeTarget.keyPrefix)}</span>
              ) will stop working immediately. Any agents using it will get 401
              errors. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRevokeTarget(null)}
                className="rounded-lg border border-border bg-transparent hover:bg-muted text-xs font-semibold px-4 py-2 text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={isRevoking}
                className="rounded-lg bg-red-500 hover:bg-red-600 text-black text-xs font-semibold px-4 py-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isRevoking ? "Revoking..." : "Yes, revoke key"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
