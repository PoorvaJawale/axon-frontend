"use client";
import { useUser } from "@clerk/nextjs";
import useSWR from "swr";
import { dashboardFetcher } from "@/lib/dashboard";

export type AccountUsage = {
  plan: "free" | "pro" | "enterprise";
  monthly_requests: number;
  request_limit: number;
  remaining: number;
};
/** One authenticated, user-scoped cache for both plan labels and quota displays. */
export function useAccountUsage(enabled = true) {
  const { user, isSignedIn } = useUser();
  return useSWR<AccountUsage>(
    enabled && isSignedIn && user?.id ? ["/webhook/usage", user.id] : null,
    ([url]: [string, string]) => dashboardFetcher(url),
    { refreshInterval: 10000, revalidateOnFocus: true }
  );
}
