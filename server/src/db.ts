import { Pool } from 'pg';

export const pool = new Pool({
  host:     process.env.DB_HOST     ?? '192.168.0.100',
  port:     Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME     ?? 'webapp',
  user:     process.env.DB_USER     ?? 'admin',
  password: process.env.DB_PASSWORD ?? 'sicherespasswort',
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
