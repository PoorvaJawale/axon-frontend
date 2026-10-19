"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useAccountUsage } from "@/lib/use-account-usage";
import { usagePercent } from "@/lib/dashboard";
import {
  LayoutDashboard,
  ScrollText,
  Bell,
  Key,
  BookOpen,
  CreditCard,
  LogOut,
} from "lucide-react";

import { FREE_VALIDATION_LIMIT, PRO_VALIDATION_LIMIT } from "@/lib/plans";


const mono = "var(--font-geist-mono)";
const line = "1px solid rgba(140,255,190,.09)";

const sections = [
  {
    head: "MONITOR",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/logs", label: "Logs", icon: ScrollText },
      { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    head: "CONFIGURE",
    items: [
      { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/docs", label: "Docs", icon: BookOpen },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { username, email, userPlan, logout, userApiKey, isPlanReady } = useAuth();

  const { data: usageData, error: usageError } = useAccountUsage(!!userApiKey);
  const monthlyRequests = usageData?.monthly_requests ?? 0;
  const requestLimit = usageData?.request_limit ?? (userPlan === "Pro" ? PRO_VALIDATION_LIMIT : FREE_VALIDATION_LIMIT);
  const pct = usagePercent(monthlyRequests, requestLimit);

  return (
    <aside
      className="dash-sidebar fixed left-0 top-0 z-40 flex h-screen w-64 flex-col"
      style={{ background: "#090c0b", borderRight: line }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, height: 60, padding: "0 18px", borderBottom: line }}>
        <BrandMark size={34} />
        <span style={{ font: "800 15px/1 var(--font-geist-sans)", letterSpacing: "-.03em" }}>Axon</span>
        <span className="ax-mono" style={{ marginLeft: "auto", font: `600 9px/1 ${mono}`, letterSpacing: ".12em", color: "#37e39b", border: "1px solid rgba(55,227,155,.28)", borderRadius: 4, padding: "4px 5px", textTransform: "uppercase" }}>
          {isPlanReady ? userPlan : "…"}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "10px 12px", overflow: "auto" }}>
        {sections.map((sec) => (
          <div key={sec.head}>
            <div className="ax-mono" style={{ font: `600 9px/1 ${mono}`, letterSpacing: ".18em", color: "#8b9a93", padding: "14px 10px 6px" }}>
              {sec.head}
            </div>
            {sec.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: 8,
                    padding: "9px 10px",
                    font: "500 13px/1 var(--font-geist-sans)",
                    color: active ? "#37e39b" : "#8b9a93",
                    background: active ? "rgba(55,227,155,.08)" : "transparent",
                    border: active ? "1px solid rgba(55,227,155,.2)" : "1px solid transparent",
                  }}
                >
                  <Icon style={{ width: 15, height: 15 }} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Quota */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ border: line, borderRadius: 11, background: "#0d100f", padding: 13 }}>
          <div className="ax-mono" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#8b9a93" }}>
            <span>{userPlan === "Free" ? "ONE-TIME ALLOWANCE" : "MONTHLY QUOTA"}</span>
            <span style={{ color: "#37e39b" }}>{usageError ? "Unavailable" : usageData ? `${pct.toFixed(1)}%` : "—"}</span>
          </div>
          <div style={{ marginTop: 9, font: "700 17px/1 var(--font-geist-sans)", letterSpacing: "-.02em" }}>
            {usageData && !usageError ? monthlyRequests.toLocaleString() : "—"}{" "}
            <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#8b9a93" }}>
              / {requestLimit >= 999999999 ? "∞" : requestLimit.toLocaleString()}
            </span>
          </div>
          <div style={{ marginTop: 10, height: 5, borderRadius: 999, background: "#1a201d", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#37e39b" }} />
          </div>
        </div>
      </div>

      {/* User */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderTop: line }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1a201d", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }} className="ax-mono">
          <span style={{ font: `700 11px/1 ${mono}`, color: "#8b9a93" }}>
            {(username || "U").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 11.5px/1.2 var(--font-geist-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={username}>{username}</div>
          <div className="ax-mono" style={{ font: `400 9.5px/1.2 ${mono}`, color: "#8b9a93", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={email}>{email}</div>
        </div>
        <button onClick={logout} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", color: "#8b9a93", display: "flex" }}>
          <LogOut style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </aside>
  );
}
