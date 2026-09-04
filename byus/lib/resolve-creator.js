import { query } from './db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Looks up a creator by either their raw id or their claimed slug -- the same
// "UUID or slug" rule /api/creators/:creatorId uses for the public profile
// itself. Pulled out here so the page's metadata and its share-image generation
// (separate Next.js functions that can't just call the route handler) don't
// each re-derive this logic. `columns` is always a hardcoded string supplied by
// the caller, never request input, so building it into the query is safe.
export async function resolveCreator(creatorId, columns) {
  const isUuid = UUID_RE.test(creatorId);
  const result = await query(
    `SELECT ${columns} FROM users WHERE ${isUuid ? 'id' : 'slug'} = $1 AND role = 'creator'`,
    [creatorId]
  );
  return result.rows[0] || null;
}
