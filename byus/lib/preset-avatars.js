// The fixed set of built-in avatar options offered in Settings for anyone who'd
// rather not upload their own photo. Kept as an explicit allowlist (not "any
// string the client sends") because this id ends up in a DB column and in a
// filesystem path lookup -- see app/api/me/avatar/preset/route.js and
// app/api/avatar/[userId]/route.js.
//
// Each one is a generated illustration, not a photo of a real person -- letting
// someone pick an actual stranger's photo as their own profile picture on a paid
// subscription platform is a different (and worse) problem than a stock "person
// at work" photo used as decorative page art, so real photos were off the table
// for this.
export const PRESET_AVATAR_IDS = Array.from(
  { length: 20 },
  (_, i) => `avatar-${String(i + 1).padStart(2, '0')}`
);

export function isValidPresetAvatarId(id) {
  return typeof id === 'string' && PRESET_AVATAR_IDS.includes(id);
}
