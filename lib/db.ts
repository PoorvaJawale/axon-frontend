import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
let pool: Pool | undefined;
export function database() {
  let connectionString = process.env.AXON_DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  if (
    process.env.NODE_ENV === "production" &&
    new URL(connectionString).searchParams.get("sslmode") !== "verify-full"
  )
    throw new Error("DATABASE_TLS_VERIFICATION_REQUIRED");
  const ca = process.env.AXON_DATABASE_CA?.replace(/\\n/g, "\n");
  if (ca) {
    const url = new URL(connectionString);
    for (const name of ["sslmode", "sslrootcert", "sslcert", "sslkey"])
      url.searchParams.delete(name);
    connectionString = url.toString();
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
      max: 3,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 15_000,
      application_name: "axon-control",
    });
    pool.on("error", () => console.error("Database idle connection failed"));
  }
  // TLS verification follows pg/connection-string configuration. Never disable certificate verification here.
  return pool;
}
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
) {
  return (await database().query<T>(sql, values)).rows;
}
export async function transaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
