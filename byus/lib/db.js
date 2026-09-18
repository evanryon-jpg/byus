// Database connection to Neon (Postgres)
// Uses the DATABASE_URL environment variable, set in .env.local (see .env.example)

import { Pool } from 'pg';

let pool;

function normalizedConnectionString(value) {
  if (!value) return value;
  try {
    const url = new URL(value);
    // TLS verification is configured explicitly on Pool below. Removing the legacy
    // sslmode query option prevents pg-connection-string from emitting a warning on
    // every serverless invocation while preserving any unrelated connection options.
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return value;
  }
}

// Reuse a single connection pool across requests (important in serverless environments
// like Vercel, where creating a new pool per request would exhaust Neon's connection limit)
function getPool() {
  if (!pool) {
    // Every warm Vercel function instance gets its own Pool -- under real concurrent
    // traffic that can mean dozens of these alive at once, each opening connections
    // independently. Left at pg's default (max: 10), that's dozens x 10 = easily past
    // a small Neon compute's connection ceiling well before the app itself is under
    // meaningful load. Bounding each instance's own pool to a handful, combined with
    // pointing DATABASE_URL at Neon's pooled endpoint (the "-pooler" host, PgBouncer in
    // transaction mode -- see the Neon dashboard's connection string toggle), is what
    // actually removes this ceiling: PgBouncer multiplexes many small per-instance pools
    // onto a much smaller number of real Postgres backend connections.
    pool = new Pool({
      connectionString: normalizedConnectionString(process.env.DATABASE_URL),
      // Neon's endpoint presents a certificate signed by a public CA, so there's no
      // reason to skip verifying it — rejectUnauthorized: false would accept a
      // certificate from anyone, making it impossible to tell a MITM'd connection
      // from the real database.
      ssl: { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 10_000,
      // Fail fast on a stuck connection attempt instead of hanging until the
      // surrounding request's own maxDuration kills the whole function -- a clear
      // "could not connect" error is far easier to diagnose under load than a generic
      // function timeout with no indication where the time went.
      connectionTimeoutMillis: 5_000,
    });

    // One-time, non-blocking sanity check -- not a hard requirement (a direct
    // connection string still works, just with a much lower real ceiling under
    // concurrent load), so this only logs rather than throwing.
    const host = (() => {
      try {
        return new URL(process.env.DATABASE_URL || '').hostname;
      } catch {
        return '';
      }
    })();
    if (host && !host.includes('-pooler')) {
      console.warn(
        'DATABASE_URL does not look like a pooled Neon connection string (no "-pooler" in the host). ' +
          'Under concurrent serverless traffic this bounds the real connection ceiling much lower than ' +
          "necessary -- copy the pooled connection string from the Neon dashboard's Connect modal instead."
      );
    }
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
