"use client";

import { SignIn } from "@clerk/nextjs";
import { Header } from "@/components/header";

const clerkAppearance = {
  variables: {
    colorPrimary: "#22c55e",
    colorBackground: "#111111",
    colorText: "#ffffff",
    colorTextSecondary: "#9ca3af",
    colorInputBackground: "#0c0c0c",
    colorInputText: "#ffffff",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "border border-[#1f2937] shadow-2xl",
    formButtonPrimary: "text-[#000000] font-semibold",
  },
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <div className="flex flex-1 items-center justify-center px-4 pt-32 pb-16 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22c55e]/5 blur-[80px]" />
        </div>

        <div className="relative z-10">
          <SignIn
            routing="hash"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/dashboard"
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </div>
  );
}
