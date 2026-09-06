import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

type DB = ReturnType<typeof createInstance>;

function createInstance() {
  const dbPath = process.env.DATABASE_PATH || "./dev.db";
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const instance = drizzle(sqlite, { schema });
  migrate(instance, { migrationsFolder: "./drizzle" });
  return instance;
}

const globalForDb = globalThis as typeof globalThis & {
  __prepprDb?: DB;
};

function getDb(): DB {
  if (!globalForDb.__prepprDb) {
    globalForDb.__prepprDb = createInstance();
  }
  return globalForDb.__prepprDb;
}

// Lazy proxy: the SQLite connection is only opened on first property access,
// not at import time. This avoids lock errors during `next build`'s parallel
// page-data collection (which imports route modules across workers).
export const db = new Proxy({} as DB, {
  get(_t, prop) {
    return Reflect.get(getDb() as object, prop) as unknown;
  },
}) as DB;

export { schema };
