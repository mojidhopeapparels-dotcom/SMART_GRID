import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let dbInstance: DatabaseSync | null = null;
let initializedPath: string | null = null;

function resolveDbPath(): string {
  const configured = process.env.SMART_GRID_DB_PATH?.trim();
  if (configured === ":memory:") return ":memory:";
  const target = configured
    ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured)
    : path.join(process.cwd(), "data", "smart_grid.db");
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return target;
}

export function normalizeRow<T = Record<string, unknown>>(row: unknown): T {
  if (!row || typeof row !== "object") return row as T;
  return { ...(row as Record<string, unknown>) } as T;
}

export function normalizeRows<T = Record<string, unknown>>(rows: unknown[]): T[] {
  return rows.map((r) => normalizeRow<T>(r));
}

function runMigrations(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = path.resolve(process.cwd(), "src", "lib", "db", "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedRows = db
    .prepare("SELECT version FROM schema_migrations")
    .all() as { version: string }[];
  const applied = new Set(appliedRows.map((r) => r.version));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString()
      );
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

export function getDb(): DatabaseSync {
  const targetPath = resolveDbPath();
  if (dbInstance && initializedPath === targetPath) {
    return dbInstance;
  }
  const db = new DatabaseSync(targetPath);
  runMigrations(db);
  dbInstance = db;
  initializedPath = targetPath;
  return db;
}

export function resetDbForTests() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
  }
  dbInstance = null;
  initializedPath = null;
}

export function withTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // already rolled back
    }
    throw err;
  }
}
