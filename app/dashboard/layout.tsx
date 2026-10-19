"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { Sidebar } from "@/components/dashboard/sidebar";
import { LogOut } from "lucide-react";
import { DashboardDialog, CopyButton } from "@/components/dashboard/ui";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { usePathname } from "next/navigation";
import "./dashboard.css";

/** Shown once, right after a user's first sign-in mints their real API key. */
function FreshKeyModal() {
  const { freshKey, dismissFreshKey } = useAuth();
  if (!freshKey) return null;
  return <DashboardDialog title="Save your API key" onClose={dismissFreshKey}><p>Your key is ready. Save it somewhere secure; it will only be shown once.</p><pre className="dash-code dash-secret">{freshKey}</pre><div className="dash-actions"><CopyButton text={freshKey} label="Copy API key" /><button className="dash-button dash-button-primary" onClick={dismissFreshKey}>I saved my key</button></div></DashboardDialog>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, userPlan, logout, isPlanReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/sign-in");
    }
  }, [isAuthenticated, router]);

  // Prevent layout flicker while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070908" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#37e39b", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="dash-shell">
      <Sidebar />
      <div className="dash-mobile-header">
        <div className="dash-mobile-brand"><Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><BrandMark size={32} /><span>Axon</span></Link><div className="dash-actions"><span className="dash-muted dash-small">{isPlanReady ? `${userPlan} plan` : "Checking plan…"}</span><button className="dash-icon-button" aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div></div>
        <nav className="dash-mobile-nav" aria-label="Dashboard navigation">
          {[["/dashboard", "Overview"], ["/dashboard/logs", "Logs"], ["/dashboard/alerts", "Alerts"], ["/dashboard/api-keys", "API keys"], ["/dashboard/billing", "Billing"], ["/dashboard/docs", "Docs"]].map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
        </nav>
      </div>
      <main className="dash-main" id="dashboard-content">
        <div className="dash-content">{children}</div>
      </main>
      <FreshKeyModal />
    </div>
  );
}
