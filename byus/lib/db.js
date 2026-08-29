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
      // Neon's endpoint presents a certificate signed by a public CA, so there's no
      // reason to skip verifying it — rejectUnauthorized: false would accept a
      // certificate from anyone, making it impossible to tell a MITM'd connection
      // from the real database.
      ssl: { rejectUnauthorized: true },
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

// Run a series of queries as a single atomic transaction. `callback` receives a client
// with the same `.query(text, params)` shape as the helper above — use it for anything
// that needs multiple statements to succeed or fail together (e.g. a webhook handler
// that claims an event ID and applies its effect in one all-or-nothing step). Rolls back
// automatically on any error, and always releases the connection back to the pool.
export async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default getPool;
