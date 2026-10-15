/** Shared dashboard transport: failed requests must never look like empty data. */
export async function dashboardFetcher(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

export function usagePercent(used: number, limit: number) {
  return limit > 0 ? Math.max(0, Math.min((used / limit) * 100, 100)) : 0;
}
