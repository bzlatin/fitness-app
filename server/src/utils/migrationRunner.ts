import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Pool } from 'pg';

type AppliedMigrationRow = {
  filename: string;
  checksum: string | null;
};

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const findMigrationsDir = async () => {
  const candidates = [
    path.resolve(process.cwd(), 'sql/migrations'),
    path.resolve(__dirname, '../../sql/migrations'),
  ];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // ignore
    }
  }

  throw new Error(
    `Could not find SQL migrations directory. Looked in: ${candidates.join(', ')}`
  );
};

const ensureMigrationsTable = async (pool: Pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const loadAppliedMigrations = async (pool: Pool) => {
  const res = await pool.query<AppliedMigrationRow>(
    'SELECT filename, checksum FROM schema_migrations'
  );
  return new Map(res.rows.map((row) => [row.filename, row.checksum]));
};

export const runSqlMigrations = async (pool: Pool) => {
  await ensureMigrationsTable(pool);

  const migrationsDir = await findMigrationsDir();
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied = await loadAppliedMigrations(pool);

  for (const filename of files) {
    const fullPath = path.join(migrationsDir, filename);
    const sql = await fs.readFile(fullPath, 'utf8');
    const checksum = sha256(sql);

    const existingChecksum = applied.get(filename);
    if (existingChecksum) {
      if (existingChecksum !== checksum) {
        throw new Error(
          `Migration checksum mismatch for ${filename}. Refusing to continue (file changed after being applied).`
        );
      }
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, checksum]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

