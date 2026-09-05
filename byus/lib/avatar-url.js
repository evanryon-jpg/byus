import crypto from 'crypto';

// Builds the public URL every page should use to display a user's avatar.
// `rawValue` is the raw `users.profile_image_url` column -- either a Blob
// pathname, a `preset:<id>` marker, or null/undefined for "no photo".
//
// /api/avatar/[userId] always lives at the same path for a given user no matter
// what photo is behind it, which used to mean switching avatars (preset to
// preset, or uploading a replacement photo) changed the database row but not
// the URL any page requested -- so the browser, and Next's image optimizer,
// had no signal that a *different* image now lives there and kept showing
// the old one until a manual hard-refresh. Appending a short hash of the raw
// column value as a cache-busting query param gives every distinct photo its
// own URL, while an unchanged photo keeps requesting the exact same URL (so
// normal caching still works) -- and a one-way hash never reveals the
// underlying Blob pathname itself in a public URL.
export function publicAvatarUrl(userId, rawValue) {
  if (!rawValue) return null;
  const version = crypto.createHash('sha1').update(rawValue).digest('hex').slice(0, 8);
  return `/api/avatar/${userId}?v=${version}`;
}
