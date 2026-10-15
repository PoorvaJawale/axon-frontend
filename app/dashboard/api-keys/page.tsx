"use client";
import { useState, useRef } from "react";
import useSWR from "swr";
import { FREE_VALIDATION_LIMIT, PRO_VALIDATION_LIMIT } from "@/lib/plans";
import { useAccountUsage } from "@/lib/use-account-usage";
import { ChevronLeft, ChevronRight, KeyRound, Plus, Shield, Trash2 } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { dashboardFetcher, usagePercent } from "@/lib/dashboard";
import { CopyButton, DashboardDialog, DataState, DocsLink, PageHeader, Status, useCompactRows, usePageNumber } from "@/components/dashboard/ui";

type ApiKeyRow = { id: number; name: string; keyPrefix: string; plan: string; isActive: boolean; createdAt: string | null; lastUsedAt: string | null; expiresAt: string | null; monthlyRequests: number };
const formatDate = (iso: string | null) => { if (!iso) return "—"; const date = new Date(iso); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

export default function ApiKeysPage() {
  const pageSize = useCompactRows() ? 2 : 6;
  const [page, setPage] = usePageNumber(pageSize);
  const { userApiKey, regenerateKey, userPlan } = useAuth();
  const query = useSWR("/webhook/api-keys", dashboardFetcher, { refreshInterval: 15000 });
  const usage = useAccountUsage(!!userApiKey);
  const keys: ApiKeyRow[] = query.data?.keys ?? [];
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const used = usage.data?.monthly_requests ?? 0;
  const limit = usage.data?.request_limit ?? (userPlan === "Pro" ? PRO_VALIDATION_LIMIT : FREE_VALIDATION_LIMIT);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !name.trim()) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/webhook/create-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      if (!response.ok) throw new Error("Create failed");
      const data = await response.json();
      if (!data.apiKey) throw new Error("Missing secret");
      setFreshKey(data.apiKey); regenerateKey(data.apiKey); setCreating(false); setName(""); void query.mutate();
    } catch { setError("Couldn't create this key. Your name has been kept; try again."); }
    finally { setBusy(false); lock.current = false; }
  };
  const revoke = async () => {
    if (!revokeTarget || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/webhook/revoke-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyId: revokeTarget.id }) });
      if (!response.ok) throw new Error("Revoke failed");
      setRevokeTarget(null); void query.mutate();
    } catch { setError("Couldn't revoke this key. Try again before assuming it is inactive."); }
    finally { setBusy(false); lock.current = false; }
  };
  return <div className="dash-page dash-fit-page dash-keys-page">
    <PageHeader title="API keys" description="Separate credentials for every agent and project. One shared monthly quota."><button className="dash-button dash-button-primary" onClick={() => { setError(""); setCreating(true); }}><Plus size={16} />Create secret key</button></PageHeader>
    <div className="dash-section-heading" style={{ flexWrap: "wrap" }}><div><h2>Workspace credentials</h2><p>{query.data && !query.error ? `${keys.filter(k => k.isActive).length} active keys` : "Loading credentials"} · Secrets are only shown at creation.</p></div><DocsLink /></div>
    <section className="dash-panel" aria-label="API keys">
      {query.isLoading || query.error || !keys.length ? <DataState loading={query.isLoading} error={query.error} retry={() => void query.mutate()} title="Create your first key" description="Give each agent its own credential so you can rotate or revoke access independently."><button className="dash-button dash-button-primary" onClick={() => setCreating(true)}><Plus size={14} />Create secret key</button></DataState> : <div className="dash-table-scroll" tabIndex={0} role="region" aria-label="Scrollable API keys"><table className="dash-table"><thead><tr><th>Name / secret</th><th>Status</th><th>Created</th><th>Last used</th><th>Validations</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{keys.slice((Math.min(page, Math.max(1, Math.ceil(keys.length / pageSize))) - 1) * pageSize, Math.min(page, Math.max(1, Math.ceil(keys.length / pageSize))) * pageSize).map(key => {
        const current = !!userApiKey && key.keyPrefix === userApiKey.slice(0, 20);
        return <tr key={key.id}><td><div className="dash-actions" style={{ flexWrap: "nowrap" }}><KeyRound size={15} className="dash-muted" /><strong className="dash-truncate" title={key.name}>{key.name}</strong>{current && <Status tone="neutral">Current</Status>}</div><div className="dash-mono dash-muted dash-small" style={{ marginTop: 6 }}>{key.keyPrefix}••••••••</div></td><td><Status tone={key.isActive ? "green" : "neutral"}>{key.isActive ? "Active" : "Revoked"}</Status></td><td className="dash-time dash-mono">{formatDate(key.createdAt)}</td><td className="dash-time dash-mono">{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never used"}</td><td className="dash-mono">{key.monthlyRequests.toLocaleString()}</td><td>{key.isActive && <button className="dash-icon-button" aria-label={`Revoke ${key.name}`} disabled={current} title={current ? "Create a new key before revoking the credential used by this session" : "Revoke key"} onClick={() => { setError(""); setRevokeTarget(key); }}><Trash2 size={15} /></button>}</td></tr>;
      })}</tbody></table></div>}
      <div className="dash-pagination"><span>{userPlan === "Free" ? "One-time allowance across all keys" : "Monthly quota across all keys"}</span><span className="dash-mono">{usage.error ? "Usage unavailable" : usage.data ? `${used.toLocaleString()} / ${limit >= 999999999 ? "Unlimited" : limit.toLocaleString()}` : "Loading usage…"}</span></div>
      {keys.length > pageSize && <div className="dash-pagination"><span>Page {Math.min(page, Math.max(1, Math.ceil(keys.length / pageSize)))} of {Math.max(1, Math.ceil(keys.length / pageSize))}</span><div className="dash-actions"><button className="dash-icon-button" aria-label="Previous keys" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={15} /></button><button className="dash-icon-button" aria-label="Next keys" disabled={page >= Math.ceil(keys.length / pageSize)} onClick={() => setPage(p => p + 1)}><ChevronRight size={15} /></button></div></div>}
      {usage.data && !usage.error && <div className="dash-quota-track" role="meter" aria-label={userPlan === "Free" ? "One-time allowance used" : "Monthly quota used"} aria-valuenow={usagePercent(used, limit)} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${usagePercent(used, limit) / 100})` }} /></div>}
    </section>
    <details className="dash-key-help"><summary>Integration &amp; key security</summary><div className="dash-key-guide"><section><h2>Connect your agent</h2><p>Pass your secret in the Authorization header on validation requests. Keep the key on your server, outside client-side code.</p><pre className="dash-code"><span className="dash-purple">Authorization:</span> <span className="dash-green">Bearer sk-axon-YOUR_KEY</span></pre><div style={{ marginTop: 16 }}><DocsLink>Read the integration guide</DocsLink></div></section><section><h2>Keep access under control</h2><ul><li>Save a new secret immediately. It is only shown once.</li><li>Rotate by creating a replacement, updating your agent, then revoking the old key.</li><li>Revoked keys stop working immediately. Rotate any key that has been exposed.</li></ul></section></div>
    <div className="dash-security-note"><Shield size={16} /><span>Your current session key is protected from revocation. Create a replacement before rotating it.</span></div>
    </details>
    {creating && <DashboardDialog title="Create secret key" busy={busy} onClose={() => { setCreating(false); setError(""); }}><form onSubmit={create}><p>Use a name that identifies the agent or project using this key.</p><label htmlFor="key-name">Key name</label><input className="dash-input" id="key-name" autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="support-agent-production" aria-describedby={error ? "key-error" : undefined} /><div className="dash-field-error" id="key-error" role={error ? "alert" : undefined}>{error}</div><div className="dash-actions"><button type="button" className="dash-button" disabled={busy} onClick={() => setCreating(false)}>Cancel</button><button className="dash-button dash-button-primary" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create key"}</button></div></form></DashboardDialog>}
    {freshKey && <DashboardDialog title="Save your secret key" onClose={() => setFreshKey(null)}><p>Copy this key somewhere secure before closing. You won’t be able to view it again.</p><pre className="dash-code dash-secret">{freshKey}</pre><div className="dash-actions"><CopyButton text={freshKey} label="Copy secret" /><button className="dash-button dash-button-primary" onClick={() => setFreshKey(null)}>I saved my key</button></div></DashboardDialog>}
    {revokeTarget && <DashboardDialog title="Revoke secret key?" busy={busy} onClose={() => { setRevokeTarget(null); setError(""); }}><p><strong>{revokeTarget.name}</strong> will stop working immediately. Agents using it will receive authentication errors. This can’t be undone.</p>{error && <div className="dash-field-error" role="alert">{error}</div>}<div className="dash-actions"><button className="dash-button" disabled={busy} onClick={() => setRevokeTarget(null)}>Keep key</button><button className="dash-button dash-button-danger" disabled={busy} onClick={() => void revoke()}>{busy ? "Revoking…" : "Revoke key"}</button></div></DashboardDialog>}
  </div>;
}
