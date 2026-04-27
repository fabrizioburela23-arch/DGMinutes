import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured (e.g. postgres://user:pass@host:5432/db)');
}

const useSsl = (() => {
  if (process.env.PGSSL === 'false') return false;
  if (process.env.PGSSL === 'true') return true;
  return /sslmode=require/i.test(DATABASE_URL) || process.env.NODE_ENV === 'production';
})();

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

export async function initializeSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      "fullName" TEXT NOT NULL,
      "interpreterId" TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL,
      "primaryContact" TEXT NOT NULL,
      "secondaryContact" TEXT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_records (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES users(id),
      "interpreterId" TEXT NOT NULL,
      username TEXT NOT NULL,
      "dateRange" TEXT NOT NULL,
      "totalMinutes" INTEGER NOT NULL,
      "totalCalls" INTEGER NOT NULL,
      "recordType" TEXT DEFAULT 'daily',
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE daily_records
    ADD COLUMN IF NOT EXISTS "recordType" TEXT DEFAULT 'daily';
  `);
}
