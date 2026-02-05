import { db } from "./db";

const getStmt = db.prepare("SELECT value, updated_at FROM cache WHERE key = ?");
const upsertStmt = db.prepare(
  "INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
);

export function getCache<T>(key: string, ttlSeconds: number): T | null {
  const row = getStmt.get(key) as { value: string; updated_at: number } | undefined;
  if (!row) return null;
  const ageSeconds = (Date.now() - row.updated_at) / 1000;
  if (ageSeconds > ttlSeconds) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, value: T) {
  upsertStmt.run(key, JSON.stringify(value), Date.now());
}
