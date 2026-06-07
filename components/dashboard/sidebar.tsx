"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/app/context/AuthContext";
import {
  LayoutDashboard,
  ScrollText,
  Bell,
  Key,
  BookOpen,
  CreditCard,
  LogOut,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/logs", label: "Logs", icon: ScrollText },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/docs", label: "Docs", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const { username, email, userPlan, logout } = useAuth();

  // Dynamically fetch usage from mock API based on current plan state
  const { data: usageData } = useSWR(`/webhook/usage?plan=${userPlan}`, fetcher);

  const monthlyRequests = usageData?.monthly_requests ?? 12847;
  const requestLimit = usageData?.request_limit ?? 50000;
  const usagePercentage = Math.min((monthlyRequests / requestLimit) * 100, 100);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border/50 bg-[#0a0a0a]">
      {/* Header logo */}
      <div className="flex h-20 items-center border-b border-border/50 px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/axon-logo.png"
            alt="Axon"
            width={160}
            height={50}
            className="h-[110px] w-auto -my-5"
          />
        </Link>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Dynamic API Usage progress bar */}
      <div className="px-4 py-3 border-t border-border/50">
        <div className="rounded-lg bg-muted/30 p-3 border border-border/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>API Usage</span>
            <span className="font-mono">{usagePercentage.toFixed(1)}%</span>
          </div>
          <p className="mt-1 text-base font-semibold text-foreground">
            {monthlyRequests.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">/ {requestLimit === 10000000 ? "Unlimited" : requestLimit.toLocaleString()}</span>
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* User info & Logout at very bottom */}
      <div className="border-t border-border/50 p-4 bg-muted/10 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground truncate max-w-[110px]" title={username}>
              {username}
            </p>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.2 text-[10px] font-semibold text-primary leading-tight shrink-0">
              {userPlan}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate" title={email}>
            {email}
          </p>
        </div>
        <button
          onClick={logout}
          title="Sign Out"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
