/**
 * Minimal in-memory mock of node:sqlite DatabaseSync.
 * Supports the subset used by push-store: exec(), prepare(), close().
 */
class MockStatement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
  }

  run(...params) {
    return this._db._execute(this._sql, params, "run");
  }

  get(...params) {
    return this._db._execute(this._sql, params, "get");
  }

  all(...params) {
    return this._db._execute(this._sql, params, "all");
  }
}

/**
 * Mock implementation of Node's DatabaseSync.
 */
class MockDatabaseSync {
  constructor() {
    this._tables = new Map();
    this._autoInc = new Map();
  }

  exec(sql) {
    const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (createMatch) {
      const table = createMatch[1];
      if (!this._tables.has(table)) {
        this._tables.set(table, []);
        this._autoInc.set(table, 0);
      }
    }
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }

  close() {
    this._tables.clear();
  }

  /**
   * Internal execution router.
   */
  _execute(sql, params, mode) {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("INSERT")) {
      return this._handleInsert(sql, params);
    }

    if (trimmed.startsWith("SELECT")) {
      return this._handleSelect(sql, params, mode);
    }

    if (trimmed.startsWith("DELETE")) {
      return this._handleDelete(sql, params);
    }

    if (trimmed.startsWith("UPDATE")) {
      return this._handleUpdate(sql, params);
    }

    return mode === "all" ? [] : undefined;
  }

  _handleUpdate(sql, params) {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch) {
      return;
    }

    const table = tableMatch[1];
    const rows = this._tables.get(table) || [];
    if (table === "scheduled_tasks" && /SET\s+last_run\s*=\s*\?/i.test(sql)) {
      const row = rows.find((r) => r.id === params[1]);
      if (row) {
        row.last_run = params[0];
      }
    }

    this._tables.set(table, rows);
  }

  _handleInsert(sql, params) {
    const tableMatch = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)/i);
    if (!tableMatch) {
      return;
    }

    const table = tableMatch[1];
    const rows = this._tables.get(table) || [];
    if (table === "vapid_keys") {
      const existing = rows.findIndex((r) => r.id === 1);
      const row = { id: 1, public_key: params[0], private_key: params[1], subject: params[2] };
      if (existing >= 0) {
        rows[existing] = row;
      } else {
        rows.push(row);
      }
    } else if (table === "subscriptions") {
      const isReplace = /OR\s+REPLACE/i.test(sql);
      const existing = rows.findIndex((r) => r.endpoint === params[0]);
      if (isReplace && existing >= 0) {
        rows[existing] = { ...rows[existing], endpoint: params[0], keys_p256dh: params[1], keys_auth: params[2] };
      } else {
        const id = (this._autoInc.get(table) || 0) + 1;
        this._autoInc.set(table, id);
        rows.push({ id, endpoint: params[0], keys_p256dh: params[1], keys_auth: params[2], created_at: new Date().toISOString() });
      }
    } else if (table === "scheduled_tasks") {
      const isReplace = /OR\s+REPLACE/i.test(sql);
      const existing = rows.findIndex((r) => r.id === params[0]);
      const row = { id: params[0], group_id: params[1], schedule: params[2], prompt: params[3], is_script: params[4], enabled: params[5], last_run: params[6], created_at: params[7], channel: params[8] ?? null, subscriber_id: params[9] ?? null };
      if (isReplace && existing >= 0) {
        rows[existing] = row;
      } else if (existing < 0) {
        rows.push(row);
      }
    }

    this._tables.set(table, rows);
  }

  _handleSelect(sql, params, mode) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      return mode === "all" ? [] : undefined;
    }

    const table = tableMatch[1];
    let rows = [...(this._tables.get(table) || [])];
    if (/WHERE\s+id\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => r.id === params[0]);
    } else if (/WHERE\s+id\s*=\s*(\d+)/i.test(sql)) {
      const idMatch = sql.match(/WHERE\s+id\s*=\s*(\d+)/i);
      if (idMatch) {
        rows = rows.filter((r) => r.id === parseInt(idMatch[1], 10));
      }
    } else if (/WHERE\s+endpoint\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => r.endpoint === params[0]);
    } else if (/WHERE\s+enabled\s*=\s*(\d+)/i.test(sql)) {
      const match = sql.match(/WHERE\s+enabled\s*=\s*(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        rows = rows.filter((r) => r.enabled === val);
      }
    } else if (/WHERE\s+group_id\s*=\s*\?/i.test(sql)) {
      if (/AND\s+subscriber_id\s*=\s*\?/i.test(sql)) {
        rows = rows.filter((r) => r.group_id === params[0] && r.subscriber_id === params[1]);
      } else {
        rows = rows.filter((r) => r.group_id === params[0]);
      }
    } else if (/WHERE\s+subscriber_id\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => r.subscriber_id === params[0]);
    }

    if (/ORDER BY\s+created_at\s+DESC/i.test(sql)) {
      rows.reverse();
    }

    return mode === "get" ? rows[0] : rows;
  }

  _handleDelete(sql, params) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      return;
    }

    const table = tableMatch[1];
    let rows = this._tables.get(table) || [];
    if (/WHERE\s+endpoint\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => r.endpoint !== params[0]);
    } else if (/WHERE\s+id\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => r.id !== params[0]);
    }

    this._tables.set(table, rows);
  }
}

exports.DatabaseSync = MockDatabaseSync;
