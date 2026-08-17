"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/app/context/AuthContext";
import { Key, Copy, Check, Plus, Trash2, Shield, Code, ShieldAlert } from "lucide-react";

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
const mono = "var(--font-geist-mono)";
const line = "1px solid rgba(140,255,190,.1)";
const panel = "#0a0d0c";
const KEY_COLS = "1.15fr 1.1fr 96px 110px 110px 120px 40px";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function maskedKey(prefix: string): string {
  return prefix ? `${prefix}••••••••` : "sk-axon-••••••••••••";
}

export default function ApiKeysPage() {
  const { userApiKey, userPlan, regenerateKey } = useAuth();

  const { data, isLoading, mutate } = useSWR("/webhook/api-keys", fetcher, { refreshInterval: 15000, revalidateOnFocus: true });
  const { data: usageData } = useSWR("/webhook/usage", fetcher, { refreshInterval: 15000, revalidateOnFocus: true });

  const keys: ApiKeyRow[] = data?.keys ?? [];
  const monthlyRequests = usageData?.monthly_requests ?? 0;
  const requestLimit = usageData?.request_limit ?? 1000;
  const currentPrefix = userApiKey ? userApiKey.slice(0, 20) : null;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copiedFresh, setCopiedFresh] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleCreate = async () => {
    setCreateError("");
    if (!newKeyName.trim()) { setCreateError("Give the key a name — e.g. the project or agent using it."); return; }
    setIsCreating(true);
    try {
      const res = await fetch("/webhook/create-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newKeyName.trim() }) });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      if (created.apiKey) { setFreshKey(created.apiKey); regenerateKey(created.apiKey); }
      setIsCreateOpen(false); setNewKeyName(""); mutate();
    } catch (err) { console.error("Key creation failed:", err); setCreateError("Could not create the key. Please try again."); }
    finally { setIsCreating(false); }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await fetch("/webhook/revoke-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyId: revokeTarget.id }) });
      if (res.ok) { setRevokeTarget(null); mutate(); } else { alert("Could not revoke the key. Please try again."); }
    } finally { setIsRevoking(false); }
  };

  const handleCopyFresh = () => {
    if (!freshKey) return;
    navigator.clipboard.writeText(freshKey);
    setCopiedFresh(true); setTimeout(() => setCopiedFresh(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "axRise .35s ease both" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, font: "700 30px/1.1 var(--font-geist-sans)", letterSpacing: "-.035em" }}>API keys</h1>
          <p style={{ margin: "8px 0 0", maxWidth: 560, font: "400 13px/1.5 var(--font-geist-sans)", color: "#8b9a93" }}>
            One key per agent or project. All keys draw on the same monthly quota ({monthlyRequests.toLocaleString()} / {requestLimit >= 999999999 ? "∞" : requestLimit.toLocaleString()} used), so you can revoke a single agent without touching the rest.
          </p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, border: "none", borderRadius: 10, background: "#37e39b", color: "#04150d", font: "700 12.5px/1 var(--font-geist-sans)", padding: "12px 16px", cursor: "pointer" }}>
          <Plus style={{ width: 14, height: 14 }} />New secret key
        </button>
      </div>

      {/* Keys table */}
      <div style={{ border: line, borderRadius: 14, background: panel, overflow: "hidden" }}>
        <div className="ax-mono" style={{ display: "grid", gridTemplateColumns: KEY_COLS, padding: "11px 18px", borderBottom: line, background: "#0d100f", font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#46534d" }}>
          <span>NAME</span><span>SECRET</span><span>STATUS</span><span>CREATED</span><span>LAST USED</span><span>VALIDATIONS</span><span></span>
        </div>
        {isLoading && <div style={{ padding: 40, textAlign: "center", color: "#5b6b64", font: "400 12px/1 var(--font-geist-sans)" }}>Loading your keys…</div>}
        {!isLoading && keys.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#5b6b64", font: "400 13px/1 var(--font-geist-sans)" }}>No API keys yet — create your first one to start validating.</div>}
        {keys.map((k, i) => {
          const isCurrent = currentPrefix !== null && k.keyPrefix === currentPrefix;
          return (
            <div key={k.id} style={{ display: "grid", gridTemplateColumns: KEY_COLS, padding: "15px 18px", borderBottom: i < keys.length - 1 ? "1px solid rgba(140,255,190,.05)" : "none", alignItems: "center", opacity: k.isActive ? 1 : 0.55 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, font: "600 12.5px/1 var(--font-geist-sans)" }}>
                <Key style={{ width: 13, height: 13, color: "#5b6b64", flex: "none" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name}</span>
                {isCurrent && <span className="ax-mono" style={{ font: `700 8.5px/1 ${mono}`, letterSpacing: ".1em", color: "#37e39b", border: "1px solid rgba(55,227,155,.28)", borderRadius: 4, padding: "3px 5px", flex: "none" }}>CURRENT</span>}
              </span>
              <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>{maskedKey(k.keyPrefix)}</span>
              <span>
                <span className="ax-mono" style={{ font: `700 9px/1 ${mono}`, color: k.isActive ? "#37e39b" : "#ff5f56", background: k.isActive ? "rgba(55,227,155,.1)" : "rgba(255,95,86,.1)", border: `1px solid ${k.isActive ? "rgba(55,227,155,.26)" : "rgba(255,95,86,.26)"}`, borderRadius: 5, padding: "4px 6px" }}>{k.isActive ? "ACTIVE" : "REVOKED"}</span>
              </span>
              <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>{formatDate(k.createdAt)}</span>
              <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>{formatDate(k.lastUsedAt)}</span>
              <span className="ax-mono" style={{ font: `600 12px/1 ${mono}`, color: "#e8edea" }}>{k.monthlyRequests.toLocaleString()}</span>
              <span style={{ display: "flex", justifyContent: "flex-end" }}>
                {k.isActive && (
                  <button onClick={() => !isCurrent && setRevokeTarget(k)} disabled={isCurrent} title={isCurrent ? "This key powers your session — create a new key first" : "Revoke this key"} style={{ background: "none", border: "none", cursor: isCurrent ? "not-allowed" : "pointer", color: isCurrent ? "#2c3733" : "#5b6b64", display: "flex", padding: 0 }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Two info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }} className="ax-keys-cards">
        <div style={{ border: line, borderRadius: 14, background: panel, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: "700 13px/1 var(--font-geist-sans)" }}>
            <Code style={{ width: 15, height: 15, color: "#37e39b" }} />Quick integration
          </div>
          <p style={{ margin: "11px 0 0", font: "400 12px/1.6 var(--font-geist-sans)", color: "#8b9a93" }}>
            Send the secret in the <span className="ax-mono" style={{ color: "#37e39b" }}>Authorization</span> header. Rotate by creating a new key and revoking the old one — never edit a key in place.
          </p>
          <div className="ax-mono" style={{ marginTop: 14, border: line, borderRadius: 9, background: "#080b0a", padding: "12px 13px", font: `400 11.5px/1.6 ${mono}` }}>
            <span style={{ color: "#a78bfa" }}>Authorization:</span> <span style={{ color: "#37e39b" }}>Bearer sk-axon-YOUR_KEY</span>
          </div>
        </div>
        <div style={{ border: "1px solid rgba(255,179,71,.2)", borderRadius: 14, background: "rgba(255,179,71,.04)", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: "700 13px/1 var(--font-geist-sans)", color: "#ffb347" }}>
            <ShieldAlert style={{ width: 15, height: 15 }} />Key hygiene
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 13, font: "400 12px/1.5 var(--font-geist-sans)", color: "#8b9a93" }}>
            {["Secrets are shown once at creation and stored hashed.", "Revoked keys stop working immediately and can be deleted.", "Rotate keys that have been exposed or are older than 90 days."].map((t) => (
              <div key={t} style={{ display: "flex", gap: 9 }}><Check style={{ width: 14, height: 14, color: "#ffb347", flex: "none" }} />{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {isCreateOpen && (
        <Modal onClose={() => { setIsCreateOpen(false); setNewKeyName(""); setCreateError(""); }}>
          <h3 style={{ margin: 0, font: "700 16px/1 var(--font-geist-sans)" }}>Create new secret key</h3>
          {createError && <div style={{ marginTop: 14, borderRadius: 8, background: "rgba(255,95,86,.1)", border: "1px solid rgba(255,95,86,.2)", padding: 11, font: "400 11px/1.4 var(--font-geist-sans)", color: "#ff9b95" }}>{createError}</div>}
          <label className="ax-mono" style={{ display: "block", font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#5b6b64", margin: "18px 0 8px" }}>KEY NAME</label>
          <input autoFocus value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="e.g. support-agent-prod"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 9, border: line, background: "#080b0a", padding: "10px 12px", font: "400 13px/1 var(--font-geist-sans)", color: "#e8edea", outline: "none" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button onClick={() => { setIsCreateOpen(false); setNewKeyName(""); setCreateError(""); }} style={btnGhost}>Cancel</button>
            <button onClick={handleCreate} disabled={isCreating} style={btnPrimary}>{isCreating ? "Creating…" : "Create key"}</button>
          </div>
        </Modal>
      )}

      {/* Fresh key modal */}
      {freshKey && (
        <Modal onClose={() => setFreshKey(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#37e39b" }}>
            <Shield style={{ width: 20, height: 20 }} /><h3 style={{ margin: 0, font: "700 16px/1 var(--font-geist-sans)", color: "#e8edea" }}>Key created</h3>
          </div>
          <p style={{ margin: "14px 0 0", font: "400 12px/1.5 var(--font-geist-sans)", color: "#8b9a93" }}>Save this key now. It will not be shown again.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div className="ax-mono" style={{ flex: 1, font: `400 12px/1.4 ${mono}`, background: "#080b0a", border: line, padding: "10px 12px", borderRadius: 9, color: "#e8edea", wordBreak: "break-all" }}>{freshKey}</div>
            <button onClick={handleCopyFresh} title="Copy" style={{ border: line, background: "#0f1312", borderRadius: 9, padding: 10, color: "#8b9a93", cursor: "pointer", display: "flex" }}>{copiedFresh ? <Check style={{ width: 16, height: 16, color: "#37e39b" }} /> : <Copy style={{ width: 16, height: 16 }} />}</button>
          </div>
          <div className="ax-mono" style={{ marginTop: 14, font: `600 10px/1.4 ${mono}`, color: "#ffb347", background: "rgba(255,179,71,.1)", border: "1px solid rgba(255,179,71,.2)", padding: "9px 11px", borderRadius: 8 }}>Warning: this key will only be shown once</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button onClick={() => setFreshKey(null)} style={btnPrimary}>I saved my key</button>
          </div>
        </Modal>
      )}

      {/* Revoke modal */}
      {revokeTarget && (
        <Modal onClose={() => setRevokeTarget(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ff5f56" }}>
            <Trash2 style={{ width: 18, height: 18 }} /><h3 style={{ margin: 0, font: "700 16px/1 var(--font-geist-sans)", color: "#e8edea" }}>Revoke &quot;{revokeTarget.name}&quot;?</h3>
          </div>
          <p style={{ margin: "14px 0 0", font: "400 12px/1.5 var(--font-geist-sans)", color: "#8b9a93" }}>
            This key (<span className="ax-mono">{maskedKey(revokeTarget.keyPrefix)}</span>) stops working immediately. Any agents using it will get 401 errors. This cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button onClick={() => setRevokeTarget(null)} style={btnGhost}>Cancel</button>
            <button onClick={handleRevoke} disabled={isRevoking} style={{ ...btnPrimary, background: "#ff5f56", color: "#180605" }}>{isRevoking ? "Revoking…" : "Yes, revoke key"}</button>
          </div>
        </Modal>
      )}

      <style>{`@media (max-width: 900px){ .ax-keys-cards { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

const btnGhost: React.CSSProperties = { border: "1px solid rgba(140,255,190,.16)", borderRadius: 9, background: "transparent", color: "#e8edea", font: "600 12px/1 var(--font-geist-sans)", padding: "10px 14px", cursor: "pointer" };
const btnPrimary: React.CSSProperties = { border: "none", borderRadius: 9, background: "#37e39b", color: "#04150d", font: "700 12px/1 var(--font-geist-sans)", padding: "10px 16px", cursor: "pointer" };

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, borderRadius: 14, border: "1px solid rgba(140,255,190,.14)", background: "#0d100f", padding: 22, boxShadow: "0 30px 80px -30px rgba(0,0,0,.9)" }}>
        {children}
      </div>
    </div>
  );
}
