"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUpRight, Check, Copy, LoaderCircle, RefreshCw, X, TriangleAlert } from "lucide-react";
import Link from "next/link";

export function PageHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <header className="dash-page-header"><div><h1>{title}</h1><p>{description}</p></div><div className="dash-header-actions">{children}</div></header>;
}

export function Status({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "red" | "amber" | "purple" | "neutral" }) {
  return <span className={`dash-status dash-${tone}`}><span aria-hidden="true" />{children}</span>;
}

export function DataState({ loading, error, title, description, retry, children }: { loading?: boolean; error?: unknown; title: string; description?: string; retry?: () => void; children?: ReactNode }) {
  return <div className="dash-data-state" role={error ? "alert" : "status"}>
    {loading ? <LoaderCircle className="dash-spinner" size={23} /> : error ? <TriangleAlert size={25} className="dash-red" /> : <div className="dash-empty-symbol"><Check size={24} /></div>}
    <h3>{loading ? "Loading data…" : error ? "Couldn't load this data" : title}</h3>
    <p>{error ? "Check your connection and try again. Your data hasn't been changed." : description}</p>
    {error && retry ? <button className="dash-button" onClick={retry}><RefreshCw size={14} />Try again</button> : !loading && children}
  </div>;
}

export function RefreshButton({ busy, onClick }: { busy?: boolean; onClick: () => void }) {
  return <button className="dash-button dash-button-quiet" onClick={onClick} disabled={busy} aria-label="Refresh data"><RefreshCw size={14} className={busy ? "dash-spinner" : ""} />{busy ? "Refreshing" : "Refresh"}</button>;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  useEffect(() => { if (state === "idle") return; const timer = setTimeout(() => setState("idle"), 2500); return () => clearTimeout(timer); }, [state]);
  return <button className="dash-button dash-button-quiet" onClick={async () => { try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("error"); } }} aria-label={label}>
    {state === "copied" ? <Check size={14} /> : <Copy size={14} />}<span aria-live="polite">{state === "copied" ? "Copied" : state === "error" ? "Copy failed. Select text." : label}</span>
  </button>;
}

export function DocsLink({ children = "Integration guide" }: { children?: ReactNode }) {
  return <Link className="dash-text-link" href="/dashboard/docs">{children}<ArrowUpRight size={14} /></Link>;
}

/** Native dialog provides focus containment, Escape, and return-focus semantics. */
export function DashboardDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; const trigger = document.activeElement as HTMLElement | null; dialog?.showModal(); return () => { dialog?.close(); trigger?.focus(); }; }, []);
  return <dialog ref={ref} className="dash-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="dash-dialog-heading"><h2>{title}</h2><button className="dash-icon-button" disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>{children}
  </dialog>;
}

const compactRowsQuery = "(max-width: 850px), (max-height: 720px)";
function subscribeCompactRows(onChange: () => void) {
  const query = window.matchMedia(compactRowsQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
/** Keep pagination usable in short windows and on phones without shrinking controls. */
export function useCompactRows() {
  return useSyncExternalStore(subscribeCompactRows, () => window.matchMedia(compactRowsQuery).matches, () => false);
}

/** A change in page size starts at the first page instead of requesting an invalid page. */
export function usePageNumber(pageSize: number) {
  const [state, setState] = useState({ pageSize, page: 1 });
  const page = state.pageSize === pageSize ? state.page : 1;
  const setPage = (update: number | ((previous: number) => number)) => {
    setState(previous => ({
      pageSize,
      page: typeof update === "function" ? update(previous.pageSize === pageSize ? previous.page : 1) : update,
    }));
  };
  return [page, setPage] as const;
}
