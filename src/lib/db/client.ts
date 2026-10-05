/**
 * One tiny query interface over two Postgres drivers:
 *  - DATABASE_URL set  -> postgres.js against Supabase / any Postgres.
 *  - otherwise         -> PGlite, real Postgres compiled to WASM, embedded in
 *                         the process. Zero setup for judges and for tests.
 */

import { SCHEMA_SQL } from "./schema";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  kind: "postgres" | "pglite";
}

async function makePostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  // prepare:false keeps Supabase's transaction pooler happy.
  const sql = postgres(url, { prepare: false, max: Number(process.env.PG_POOL_MAX || 5), idle_timeout: 20 });
  return {
    kind: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as never[])) as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text);
    },
  };
}

async function makePglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  return {
    kind: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query<T>(text, params);
      return res.rows;
    },
    async exec(text: string) {
      await pg.exec(text);
    },
  };
}

const g = globalThis as unknown as { __shopsenseDb?: Promise<Db> };

/** Process-wide database handle, schema applied. */
export function getDb(): Promise<Db> {
  if (!g.__shopsenseDb) {
    g.__shopsenseDb = (async () => {
      const url = process.env.DATABASE_URL;
      const db = url
        ? await makePostgres(url)
        : await makePglite(process.env.PGLITE_DIR || undefined);
      await db.exec(SCHEMA_SQL);
      return db;
    })().catch((err) => {
      g.__shopsenseDb = undefined;
      throw err;
    });
  }
  return g.__shopsenseDb;
}

/** For tests: a fresh in-memory database. */
export async function memoryDb(): Promise<Db> {
  const db = await makePglite();
  await db.exec(SCHEMA_SQL);
  return db;
}
