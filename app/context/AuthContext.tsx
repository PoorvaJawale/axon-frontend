"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";

export type PlanType = "Free" | "Pro" | "Enterprise";

interface AuthContextType {
  isAuthenticated: boolean;
  userApiKey: string | null;
  userPlan: PlanType;
  username: string;
  email: string;
  /** Full key returned once at first provisioning (null afterwards). */
  freshKey: string | null;
  dismissFreshKey: () => void;
  logout: () => void;
  updatePlan: (plan: PlanType) => void;
  regenerateKey: (newKey: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toPlanType(plan: string | null | undefined): PlanType {
  const p = (plan || "free").toLowerCase();
  if (p === "pro") return "Pro";
  if (p === "enterprise") return "Enterprise";
  return "Free";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<PlanType>("Free");
  const [provisioning, setProvisioning] = useState(false);

  // Once signed in, make sure this user has a real Axon API key.
  useEffect(() => {
    if (!isSignedIn || userApiKey || provisioning) return;
    setProvisioning(true);

    fetch("/webhook/create-api-key", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.apiKey) {
          // Newly created — show the full key once so the user can save it.
          setUserApiKey(data.apiKey);
          setFreshKey(data.apiKey);
        } else if (data.keyPrefix) {
          // Existing user — only the safe prefix ever reaches the browser.
          setUserApiKey(data.keyPrefix);
        }
        setUserPlan(toPlanType(data.plan));
      })
      .catch((err) => console.error("Key provisioning failed:", err))
      .finally(() => setProvisioning(false));
  }, [isSignedIn, userApiKey, provisioning]);

  const logout = () => {
    setUserApiKey(null);
    setFreshKey(null);
    signOut({ redirectUrl: "/" });
  };

  const updatePlan = (plan: PlanType) => {
    setUserPlan(plan);
  };

  const regenerateKey = (newKey: string) => {
    setUserApiKey(newKey);
  };

  const dismissFreshKey = () => setFreshKey(null);

  if (!isLoaded) {
    return null; // Don't render children until Clerk knows the auth status
  }

  const username =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Guest User";

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!isSignedIn,
        userApiKey,
        userPlan,
        username,
        email: user?.primaryEmailAddress?.emailAddress || "",
        freshKey,
        dismissFreshKey,
        logout,
        updatePlan,
        regenerateKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
