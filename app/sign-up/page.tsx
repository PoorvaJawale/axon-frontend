"use client";

import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Header } from "@/components/header";

const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#37e39b",
    colorPrimaryForeground: "#000000",
    colorBackground: "#0a0d0c",
    colorForeground: "#ffffff",
    colorMutedForeground: "#9ca3af",
    colorInput: "#080b0a",
    colorInputForeground: "#ffffff",
    colorBorder: "#1f2937",
    colorNeutral: "#ffffff",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "border border-[#1f2937] shadow-2xl",
    formButtonPrimary: "!text-[#000000] font-semibold",
  },
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#000000] text-[#ffffff]">
      <Header />

      <div className="flex flex-1 items-center justify-center px-4 pt-32 pb-16 relative z-10">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#37e39b]/5 blur-[80px]" />
        </div>

        <div className="relative z-10">
          <SignUp
            routing="hash"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/dashboard"
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </div>
  );
}
