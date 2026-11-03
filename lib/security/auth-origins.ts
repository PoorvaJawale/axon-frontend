/** Server-configured Clerk token origins; request Host/Forwarded headers are never consulted. */
export function authorizedOrigins(
  env: Record<string, string | undefined> = process.env,
) {
  const canonical = new URL(
    env.AXON_PUBLIC_SITE_URL || "https://axon-frontend-vxa8.vercel.app",
  );
  if (
    canonical.username ||
    canonical.password ||
    canonical.search ||
    canonical.hash ||
    canonical.pathname !== "/" ||
    (canonical.protocol !== "https:" &&
      !(
        env.NODE_ENV !== "production" &&
        canonical.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(canonical.hostname)
      ))
  )
    throw new Error("INVALID_AUTH_CANONICAL_ORIGIN");
  const allowed = new Set([canonical.origin]);
  if (
    env.VERCEL === "1" &&
    env.VERCEL_URL &&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/.test(env.VERCEL_URL)
  )
    allowed.add("https://" + env.VERCEL_URL);
  if (env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://localhost:3101");
  }
  return [...allowed];
}
