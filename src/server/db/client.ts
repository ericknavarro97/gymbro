import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres + Drizzle singleton.
 *
 * - Next dev (HMR) re-evaluates modules on every change; caching the client on
 *   `globalThis` avoids leaking a new connection pool per reload.
 * - On Vercel each function instance keeps one small pool. With Neon use the
 *   pooled connection string (`-pooler` host); `prepare: false` keeps it
 *   compatible with PgBouncer transaction mode.
 */
type Db = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

const globalForDb = globalThis as unknown as {
  __gymbrosSql?: postgres.Sql;
  __gymbrosDb?: Db;
};

function createSql(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return postgres(url, {
    max: process.env.VERCEL ? 1 : 10,
    prepare: false,
    idle_timeout: 20,
  });
}

export const sql: postgres.Sql = globalForDb.__gymbrosSql ?? createSql();
export const db: Db =
  globalForDb.__gymbrosDb ?? drizzle(sql, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__gymbrosSql = sql;
  globalForDb.__gymbrosDb = db;
}

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
