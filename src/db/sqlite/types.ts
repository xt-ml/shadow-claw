import type { DatabaseSync } from "node:sqlite";

/**
 * Branded wrapper around `DatabaseSync` (node:sqlite) used as the headless
 * CLI database backend. Passed through the same `ShadowClawDatabase` slot as
 * `IDBDatabase` — dual-dispatch branches in each `src/db/*.ts` module detect
 * this type via `isSqliteDatabase()` and execute SQL instead of IDB calls.
 */
export interface ShadowClawSqliteDatabase {
  readonly __brand: "ShadowClawSqliteDatabase";
  readonly db: DatabaseSync;
}

/**
 * Type guard — returns true when `db` is the SQLite backend.
 */
export function isSqliteDatabase(db: unknown): db is ShadowClawSqliteDatabase {
  return (
    db !== null &&
    typeof db === "object" &&
    (db as any).__brand === "ShadowClawSqliteDatabase"
  );
}

/**
 * Wrap a raw `DatabaseSync` instance in the branded type.
 */
export function wrapSqliteDatabase(
  raw: DatabaseSync,
): ShadowClawSqliteDatabase {
  return { __brand: "ShadowClawSqliteDatabase", db: raw };
}
