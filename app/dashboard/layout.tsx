"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Shield, Copy, Check } from "lucide-react";

/** Shown once, right after a user's first sign-in mints their real API key. */
function FreshKeyModal() {
  const { freshKey, dismissFreshKey } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!freshKey) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(freshKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-[500px] rounded-xl border border-[#22c55e]/20 bg-[#111111] p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3 text-[#22c55e]">
          <div className="rounded-lg bg-[#22c55e]/10 p-2 border border-[#22c55e]/20">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Your API Key is Ready</h3>
        </div>

        <p className="text-xs text-[#9ca3af] leading-relaxed">
          Save this key now — it will not be shown again. Use it in the{" "}
          <code className="text-[#22c55e] font-mono">Authorization</code> header
          of your validation requests.
        </p>

        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-xs bg-[#0c0c0c] border border-[#1f2937] px-3.5 py-2.5 rounded-lg text-white select-all break-all">
            {freshKey}
          </div>
          <button
            onClick={handleCopy}
            className="rounded-lg border border-[#1f2937] bg-[#0c0c0c] hover:bg-[#1f2937] p-2.5 text-[#9ca3af] hover:text-white transition-colors cursor-pointer"
            title="Copy API Key"
          >
            {copied ? (
              <Check className="h-4.5 w-4.5 text-[#22c55e]" />
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
            onClick={dismissFreshKey}
            className="rounded-lg bg-[#22c55e] text-black hover:bg-[#22c55e]/90 text-xs font-semibold px-5 py-2 transition-colors cursor-pointer"
          >
            I saved my key
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

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
    <div className="min-h-screen" style={{ background: "#070908" }}>
      <Sidebar />
      <main className="pl-64">
        <div style={{ padding: "28px 26px 60px" }}>{children}</div>
      </main>
      <FreshKeyModal />
    </div>
  );
}
