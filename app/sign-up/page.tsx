"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { useAuth } from "@/app/context/AuthContext";

export default function SignUpPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName || fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setIsLoading(true);

    // Simulate account registration
    setTimeout(() => {
      const dummyKey = "sk-axon-freekey" + Math.random().toString(36).substring(2, 10);
      login(email, dummyKey, "Free");
      setIsLoading(false);
      router.push("/dashboard");
    }, 800);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      {/* Centered Sign Up card wrapper */}
      <div className="flex flex-1 items-center justify-center px-4 pt-32 pb-16 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22c55e]/5 blur-[80px]" />
        </div>

        <div className="w-full max-w-[440px] rounded-xl border border-[#1f2937] bg-[#111111] p-8 shadow-2xl relative z-10">
          <div className="mb-8 flex flex-col items-center">
            {/* Centered logo */}
            <Link href="/" className="mb-4">
              <Image
                src="/axon-logo.png"
                alt="Axon"
                width={1200}
                height={400}
                className="h-[100px] w-auto -my-4"
              />
            </Link>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Create your account
            </h2>
            <p className="mt-1 text-sm text-[#9ca3af]">
              Start securing your AI outputs in minutes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-[#9ca3af] mb-1.5"
              >
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full rounded-lg border border-[#1f2937] bg-[#0c0c0c] px-3.5 py-2 text-sm text-white placeholder-[#4b5563] outline-none transition-colors focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#9ca3af] mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[#1f2937] bg-[#0c0c0c] px-3.5 py-2 text-sm text-white placeholder-[#4b5563] outline-none transition-colors focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#9ca3af] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#1f2937] bg-[#0c0c0c] px-3.5 py-2 text-sm text-white placeholder-[#4b5563] outline-none transition-colors focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]"
              />
            </div>

            <div className="flex items-start">
              <div className="flex h-5 items-center">
                <input
                  id="agreeTerms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="h-4 w-4 rounded border-[#1f2937] bg-[#0c0c0c] text-[#22c55e] transition-colors focus:ring-0"
                />
              </div>
              <div className="ml-3 text-xs">
                <label htmlFor="agreeTerms" className="text-[#9ca3af] select-none leading-relaxed">
                  By signing up you agree to our{" "}
                  <Link href="#" className="font-semibold text-[#22c55e] hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="font-semibold text-[#22c55e] hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#22c55e] py-2.5 text-sm font-semibold text-[#000000] transition-colors hover:bg-[#22c55e]/90 focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:ring-offset-2 focus:ring-offset-[#111111] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#9ca3af]">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-[#22c55e] transition-colors hover:text-[#22c55e]/80"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
