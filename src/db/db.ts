import type { ShadowClawDatabase } from "../types.js";
export type { ShadowClawDatabase };

/**
 * Variable to hold the database instance
 */
let shadowAgentDatabase: ShadowClawDatabase | null = null;
let dbResolve: ((db: ShadowClawDatabase) => void) | null = null;
const dbPromise = new Promise<ShadowClawDatabase>((resolve) => {
  dbResolve = resolve;
});

/**
 * Get the database instance. Returns a promise that resolves when the database
 * has been initialized via setDB().
 */
export function getDb(): Promise<ShadowClawDatabase> {
  if (shadowAgentDatabase) {
    return Promise.resolve(shadowAgentDatabase);
  }

  return dbPromise;
}

/**
 * Set the database instance and resolve any pending getDb() calls.
 */
export function setDB(db: ShadowClawDatabase): void {
  if (!db) {
    throw new Error("Database not initialized");
  }

  shadowAgentDatabase = db;

  if (dbResolve) {
    dbResolve(db);
    dbResolve = null;
  }
}
