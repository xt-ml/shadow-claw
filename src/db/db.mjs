/** @typedef {IDBDatabase|null} ShadowClawDatabase */

/** @type {ShadowClawDatabase} */
let shadowClawDatabase = null;

/**
 * Get the database instance
 *
 * @returns {ShadowClawDatabase}
 */
export function getDb() {
  if (!shadowClawDatabase) {
    throw new Error("Database not initialized. Call openDatabase() first.");
  }

  return shadowClawDatabase;
}

/**
 * Set the database instance
 *
 * @param {ShadowClawDatabase} db
 */
export function setDB(db) {
  if (!db) {
    throw new Error("Database not initialized. Call openDatabase() first.");
  }

  shadowClawDatabase = db;
}
