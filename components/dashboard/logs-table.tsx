import type { LogEntry } from "@/app/api/logs/route";

interface LogsTableProps {
  logs: LogEntry[];
}

export function LogsTable({ logs }: LogsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="border-b border-border/50 px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Logs</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 text-left">
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Time
              </th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Action Type
              </th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Result
              </th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {logs.map((log) => (
              <tr
                key={log.id}
                className="transition-colors hover:bg-muted/30"
              >
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {log.time}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                  {log.actionType}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <ResultBadge result={log.result} />
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {log.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: LogEntry["result"] }) {
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

export function LogsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
      <div className="border-b border-border/50 px-6 py-4">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
