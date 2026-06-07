"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export type PlanType = "Free" | "Pro" | "Enterprise";

interface AuthContextType {
  isAuthenticated: boolean;
  userApiKey: string | null;
  userPlan: PlanType;
  username: string;
  email: string;
  login: (email: string, apiKey: string, plan: PlanType) => void;
  logout: () => void;
  updatePlan: (plan: PlanType) => void;
  regenerateKey: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<PlanType>("Free");
  const [username, setUsername] = useState<string>("Guest User");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Load auth info from localStorage on mount
    const savedKey = localStorage.getItem("axon_api_key");
    const savedEmail = localStorage.getItem("axon_email");
    const savedName = localStorage.getItem("axon_username") || "Poorva Jawale";
    const savedPlan = localStorage.getItem("axon_plan") as PlanType;

    if (savedKey) {
      setUserApiKey(savedKey);
      setIsAuthenticated(true);
      setEmail(savedEmail || "poorva@example.com");
      setUsername(savedName);
      setUserPlan(savedPlan || "Free");
    }
    setLoading(false);
  }, []);

  const login = (userEmail: string, apiKey: string, plan: PlanType) => {
    const defaultName = "Poorva Jawale";
    localStorage.setItem("axon_api_key", apiKey);
    localStorage.setItem("axon_email", userEmail);
    localStorage.setItem("axon_username", defaultName);
    localStorage.setItem("axon_plan", plan);

    setUserApiKey(apiKey);
    setEmail(userEmail);
    setUsername(defaultName);
    setUserPlan(plan);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("axon_api_key");
    localStorage.removeItem("axon_email");
    localStorage.removeItem("axon_username");
    localStorage.removeItem("axon_plan");

    setUserApiKey(null);
    setEmail("");
    setUsername("Guest User");
    setUserPlan("Free");
    setIsAuthenticated(false);
    router.push("/sign-in");
  };

  const updatePlan = (plan: PlanType) => {
    localStorage.setItem("axon_plan", plan);
    setUserPlan(plan);
  };

  const regenerateKey = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomStr = "";
    for (let i = 0; i < 24; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newKey = `sk-axon-${randomStr}`;
    localStorage.setItem("axon_api_key", newKey);
    setUserApiKey(newKey);
    return newKey;
  };

  if (loading) {
    return null; // Don't render children until we know the auth status
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userApiKey,
        userPlan,
        username,
        email,
        login,
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
