"use client";

import useSWR from "swr";
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { MetricCard, MetricCardSkeleton } from "@/components/dashboard/metric-card";
import { LogsTable, LogsTableSkeleton } from "@/components/dashboard/logs-table";
import { AlertPanel, AlertPanelSkeleton } from "@/components/dashboard/alert-panel";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const { data: logsData, isLoading: logsLoading } = useSWR("/api/logs", fetcher);
  const { data: alertsData, isLoading: alertsLoading } = useSWR("/api/alerts", fetcher);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Monitor your AI validation pipeline in real-time
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {logsLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Validations"
              value={logsData?.stats?.total ?? 0}
              icon={Activity}
              trend={{ value: 12, isPositive: true }}
            />
            <MetricCard
              title="Passed"
              value={logsData?.stats?.passed ?? 0}
              icon={CheckCircle}
              variant="success"
              trend={{ value: 8, isPositive: true }}
            />
            <MetricCard
              title="Blocked"
              value={logsData?.stats?.blocked ?? 0}
              icon={XCircle}
              variant="danger"
              trend={{ value: 3, isPositive: false }}
            />
            <MetricCard
              title="Async Flags"
              value={logsData?.stats?.asyncFlags ?? 0}
              icon={Clock}
              variant="warning"
            />
          </>
        )}
      </div>

      {/* Logs Table */}
      {logsLoading ? (
        <LogsTableSkeleton />
      ) : (
        <LogsTable logs={logsData?.logs ?? []} />
      )}

      {/* Alert Panel */}
      {alertsLoading ? (
        <AlertPanelSkeleton />
      ) : (
        <AlertPanel alerts={alertsData?.alerts ?? []} />
      )}
    </div>
  );
}
