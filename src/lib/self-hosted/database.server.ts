import { Pool } from "pg";

import { getSelfHostedConfig } from "./config";

declare global {
  // Reuse the pool across Vite hot reloads in development.
  var giftPlanDatabasePool: Pool | undefined;
}

export function getDatabasePool(): Pool {
  if (globalThis.giftPlanDatabasePool) return globalThis.giftPlanDatabasePool;

  const config = getSelfHostedConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });

  pool.on("error", (error) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        scope: "database",
        msg: "idle PostgreSQL client error",
        err: error.message,
      }),
    );
  });

  globalThis.giftPlanDatabasePool = pool;
  return pool;
}

export async function pingDatabase(timeoutMs = 3_000): Promise<number> {
  const pool = getDatabasePool();
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("PostgreSQL health check timed out")),
          timeoutMs,
        );
      }),
    ]);
    return Date.now() - startedAt;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
