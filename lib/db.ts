import Database from "better-sqlite3";
import path from "path";

const dbPath =
  process.env.SQLITE_PATH ??
  (process.env.VERCEL
    ? "/tmp/polymarket-alpha.db"
    : path.join(process.cwd(), "polymarket-alpha.db"));

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

export function getDbPath() {
  return dbPath;
}
