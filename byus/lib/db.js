// Database connection to Neon (Postgres)
// Uses the DATABASE_URL environment variable, set in .env.local (see .env.example)

import { Pool } from 'pg';

let pool;

// Reuse a single connection pool across requests (important in serverless environments
// like Vercel, where creating a new pool per request would exhaust Neon's connection limit)
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// Run a query against the database. Use this everywhere instead of creating
// new connections directly.
export async function query(text, params) {
  const client = getPool();
  const result = await client.query(text, params);
  return result;
}

export default getPool;
