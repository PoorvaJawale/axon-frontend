import { connection } from "next/server";
import type { Metadata } from "next";
import { GeistSans as geistSans } from "geist/font/sans";
import { GeistMono as geistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Axon - AI Output Validation Middleware",
  description:
    "Stop AI agents from breaking your production systems. Axon validates AI outputs before they reach production.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection(); // Per-request rendering keeps CSP script nonces consistent.
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        theme: dark,
        variables: { colorPrimary: "#37e39b" },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      >
        <body className="min-h-screen antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
