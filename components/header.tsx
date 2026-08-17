"use client";

import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

const tickerItems = (
  <>
    <span style={{ color: "#37e39b" }}>● PASS</span>
    <span>db.write · schema_ok · 41ms</span>
    <span style={{ color: "#ff5f56" }}>● BLOCK</span>
    <span>payment · amount_out_of_policy · 63ms</span>
    <span style={{ color: "#37e39b" }}>● PASS</span>
    <span>email · pii_clean · 28ms</span>
    <span style={{ color: "#ffb347" }}>● FLAG</span>
    <span>chat · tone_review · async</span>
    <span style={{ color: "#37e39b" }}>● PASS</span>
    <span>api_call · 33ms</span>
  </>
);

export function Header() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 40 }}>
      {/* Live ticker */}
      <div
        style={{
          overflow: "hidden",
          borderBottom: "1px solid var(--ax-line)",
          background: "#090c0b",
          height: 34,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", width: "200%", animation: "axTicker 34s linear infinite" }}>
          {[0, 1].map((k) => (
            <div
              key={k}
              className="ax-mono"
              style={{
                display: "flex",
                gap: 34,
                width: "50%",
                flex: "none",
                paddingLeft: 24,
                alignItems: "center",
                font: "500 10px/1 var(--font-geist-mono)",
                letterSpacing: ".08em",
                color: "#5b6b64",
                whiteSpace: "nowrap",
              }}
            >
              {tickerItems}
            </div>
          ))}
        </div>
      </div>

      {/* Header bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 68,
          padding: "0 40px",
          borderBottom: "1px solid var(--ax-line)",
          background: "rgba(7,9,8,.86)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: "linear-gradient(145deg,#37e39b,#159a63)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#04150d",
                font: "800 12px/1 var(--font-geist-sans)",
              }}
            >
              A
            </div>
            <span style={{ font: "800 17px/1 var(--font-geist-sans)", letterSpacing: "-.03em", color: "#e8edea" }}>
              Axon
            </span>
          </Link>
          <nav
            className="hidden md:flex"
            style={{ gap: 26, font: "500 13px/1 var(--font-geist-sans)", color: "#8b9a93" }}
          >
            <Link href="/#features" style={{ color: "#8b9a93" }}>Platform</Link>
            <Link href="/#pricing" style={{ color: "#8b9a93" }}>Pricing</Link>
            <Link href="/docs" style={{ color: "#8b9a93" }}>Docs</Link>
            <Link href="/#security" style={{ color: "#8b9a93" }}>Security</Link>
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {!isLoaded ? (
            <div style={{ width: 120, height: 34 }} />
          ) : isSignedIn ? (
            <>
              <Link href="/dashboard" style={{ font: "500 13px/1 var(--font-geist-sans)", color: "#c3cec8" }}>
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" style={{ font: "500 13px/1 var(--font-geist-sans)", color: "#c3cec8" }}>
                Sign in
              </Link>
              <Link
                href="/sign-up"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  font: "600 13px/1 var(--font-geist-sans)",
                  color: "#04150d",
                  background: "#37e39b",
                  padding: "10px 15px",
                  borderRadius: 9,
                }}
              >
                Get API key <ArrowRight style={{ width: 14, height: 14 }} />
              </Link>
            </>
          )}
        </div>
      </header>
    </div>
  );
}
