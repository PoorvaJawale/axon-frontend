"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useAccountUsage } from "@/lib/use-account-usage";

export type PlanType = "Free" | "Pro" | "Enterprise";

interface AuthContextType {
  isAuthenticated: boolean;
  provisioningError: string;
  retryProvisioning: () => void;
  userApiKey: string | null;
  userPlan: PlanType;
  isPlanReady: boolean;
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

  const [provisioningError, setProvisioningError] = useState("");
  const [provisioningAttempt, setProvisioningAttempt] = useState(0);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<PlanType>("Free");
  const provisioning = useRef<{
    userId: string;
    request: Promise<{
      apiKey?: string;
      keyPrefix?: string;
      plan?: string;
    } | null>;
  } | null>(null);
  const usage = useAccountUsage(!!isSignedIn);
  const effectivePlan = toPlanType(usage.data?.plan ?? userPlan);

  // Once signed in, make sure this user has a real Axon API key.
  useEffect(() => {
    if (!isSignedIn || !user?.id || userApiKey) return;
    if (provisioning.current?.userId !== user.id) {
      provisioning.current = {
        userId: user.id,
        request: fetch("/webhook/create-api-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok)
            throw new Error(
              data.error || "Could not prepare your API key. Try again.",
            );
          return data;
        }),
      };
    }
    let active = true;
    provisioning.current.request
      .then((data) => {
        if (!active || !data) return;
        setProvisioningError("");
        if (data.apiKey) {
          setUserApiKey(data.keyPrefix || data.apiKey.slice(0, 20));
          setFreshKey(data.apiKey);
        } else if (data.keyPrefix) {
          setUserApiKey(data.keyPrefix);
        }
        setUserPlan(toPlanType(data.plan));
      })
      .catch((error) => {
        if (active)
          setProvisioningError(
            error instanceof Error
              ? error.message
              : "Could not prepare your key. Try again.",
          );
      });
    return () => {
      active = false;
    };
  }, [isSignedIn, user?.id, userApiKey, provisioningAttempt]);

  const logout = () => {
    provisioning.current = null;
    setUserApiKey(null);
    setFreshKey(null);
    signOut({ redirectUrl: "/" });
  };

  const updatePlan = (plan: PlanType) => {
    setUserPlan(plan);
    void usage.mutate(
      (current) =>
        current
          ? {
              ...current,
              plan: plan.toLowerCase() as "free" | "pro" | "enterprise",
            }
          : current,
      { revalidate: true },
    );
  };

  const regenerateKey = (newKey: string) => {
    setUserApiKey(newKey.slice(0, 20));
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
        provisioningError,
        retryProvisioning: () => {
          provisioning.current = null;
          setProvisioningError("");
          setProvisioningAttempt((n) => n + 1);
        },
        userApiKey,
        userPlan: effectivePlan,
        isPlanReady: !!usage.data,
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
