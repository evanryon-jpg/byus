// Fixed built-in avatar options for people who prefer not to upload a photo.
// These IDs are an explicit allowlist because they are stored in the users table
// and later resolved by the public avatar route.
export const PRESET_AVATAR_IDS = Array.from(
  { length: 40 },
  (_, i) => `avatar-${String(i + 1).padStart(2, '0')}`
);

export function isValidPresetAvatarId(id) {
  return typeof id === 'string' && PRESET_AVATAR_IDS.includes(id);
}
