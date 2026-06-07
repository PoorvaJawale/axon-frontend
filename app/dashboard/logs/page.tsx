"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/app/context/AuthContext";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  Copy,
  Check,
  Calendar,
} from "lucide-react";

export type WebhookLogEntry = {
  id: string;
  time: string;
  agentId: string;
  actionType: "email" | "database" | "payment" | "chat" | "api_call";
  layerTriggered: string;
  result: "PASS" | "BLOCK" | "ASYNC FLAG";
  reason: string;
  outputContent: string;
};

const fetcher = (url: string, token: string | null) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
  }).then((res) => res.json());

export default function LogsPage() {
  const { userApiKey, userPlan } = useAuth();
  
  // State for search and filtering
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Debounce search input to avoid spamming mock API requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // reset page on search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Construct URL with query parameters
  const queryParams = new URLSearchParams({
    page: currentPage.toString(),
    limit: "10", // Using 10 per page for better layout and testing
    result: resultFilter,
    actionType: actionFilter,
    search: debouncedSearch,
  });

  const { data, isLoading } = useSWR(
    userApiKey ? [`/webhook/logs?${queryParams.toString()}&plan=${userPlan}`, userApiKey] : null,
    ([url, token]) => fetcher(url, token)
  );

  const logs = data?.logs ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalCount: 0 };

  const handleRowClick = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  return (
    <div className="space-y-6 text-white">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Validation Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review historical validation queries sent to Axon middleware
        </p>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border/50 bg-[#111111]/30 p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Agent ID or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-[#0c0c0c] pl-10 pr-3.5 py-2 text-sm text-white placeholder-muted-foreground/60 outline-none transition-colors focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]"
            />
          </div>

          {/* Filter Result Dropdown */}
          <div className="relative">
            <select
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-sm text-white outline-none focus:border-[#22c55e]"
            >
              <option value="All">Result: All</option>
              <option value="PASS">PASS</option>
              <option value="BLOCK">BLOCK</option>
              <option value="ASYNC FLAG">ASYNC FLAG</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none text-muted-foreground" />
          </div>

          {/* Filter Action Type Dropdown */}
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none rounded-lg border border-border bg-[#0c0c0c] px-3.5 py-2 text-sm text-white outline-none focus:border-[#22c55e] capitalize"
            >
              <option value="All">Action: All</option>
              <option value="email">email</option>
              <option value="database">database</option>
              <option value="payment">payment</option>
              <option value="chat">chat</option>
              <option value="api_call">api_call</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none text-muted-foreground" />
          </div>

          {/* Date Pickers (Custom representation) */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-[#0c0c0c] px-2 py-1.5 text-xs text-white outline-none focus:border-[#22c55e]"
              title="Start Date"
            />
            <span className="text-muted-foreground text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-[#0c0c0c] px-2 py-1.5 text-xs text-white outline-none focus:border-[#22c55e]"
              title="End Date"
            />
          </div>
        </div>
      </div>

      {/* Logs Table Container */}
      <div className="rounded-xl border border-border/50 bg-[#111111]/30 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <LogsTableLoader />
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">No logs found matching your filters.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border/50 bg-muted/5">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10"></th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Time
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Agent ID
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Action Type
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Layer Triggered
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Result
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((log: WebhookLogEntry) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      {/* Main Row */}
                      <tr
                        onClick={() => handleRowClick(log.id)}
                        className={`transition-colors hover:bg-muted/10 cursor-pointer ${
                          isExpanded ? "bg-muted/5" : ""
                        }`}
                      >
                        <td className="px-6 py-4 text-center">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-muted-foreground">
                          {log.time}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-foreground">
                          {log.agentId}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground capitalize">
                          {log.actionType}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                          {log.layerTriggered}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <ResultBadge result={log.result} />
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-[200px]" title={log.reason}>
                          {log.reason}
                        </td>
                      </tr>

                      {/* Expanded Raw Output Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 bg-[#0a0a0a]/50 border-t border-border/30">
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="font-semibold text-white">RAW AGENT OUTPUT VALIDATED</span>
                                <span>Layer: {log.layerTriggered}</span>
                              </div>
                              <ExpandedCodeBlock code={log.outputContent} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {logs.length > 0 && (
          <div className="flex items-center justify-between border-t border-border/50 bg-[#111111]/10 px-6 py-4 text-sm">
            <span className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-white">{logs.length}</span> logs of{" "}
              <span className="font-semibold text-white">{pagination.totalCount}</span> total entries
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-xs text-muted-foreground">
                Page <span className="text-white font-semibold">{currentPage}</span> of{" "}
                <span className="text-white font-semibold">{pagination.totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, pagination.totalPages))}
                disabled={currentPage === pagination.totalPages}
                className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Result badge renderer
function ResultBadge({ result }: { result: "PASS" | "BLOCK" | "ASYNC FLAG" }) {
  const styles = {
    PASS: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    BLOCK: "bg-red-500/10 text-red-400 border-red-500/20",
    "ASYNC FLAG": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[result]}`}
    >
      {result}
    </span>
  );
}

// Expanded code block component with syntax highlighting & macOS style header
function ExpandedCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#0a0a0a] shadow-inner relative">
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2 bg-muted/5">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded border border-border/50 bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-primary" />
              <span className="text-primary">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed bg-[#0c0c0c] text-muted-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Skeleton loader
function LogsTableLoader() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 w-4 rounded bg-muted/20" />
          <div className="h-4 w-24 rounded bg-muted/20" />
          <div className="h-4 w-28 rounded bg-muted/20" />
          <div className="h-4 w-16 rounded bg-muted/20" />
          <div className="h-4 flex-1 rounded bg-muted/20" />
        </div>
      ))}
    </div>
  );
}
