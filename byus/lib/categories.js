// The fixed set of categories a creator can pick from on the Settings page (see
// app/settings/page.js) to describe what they make -- shown as filter chips on the
// public Browse page (app/browse/page.js) and enforced server-side by normalizeTags()
// in app/api/me/route.js. Deliberately a closed list rather than free text: once there's
// more than one creator on ByUs, free-text tags fragment immediately (two creators
// posting near-identical content end up with two different, non-matching words), which
// defeats the whole point of a filter chip. Add a new category here -- and only here --
// if ByUs needs one; every consumer imports from this one place.
//
// Kept lowercase with no "&" or other punctuation, since normalizeTags() only accepts
// letters/numbers/spaces/hyphens and lowercases everything anyway -- writing these
// lowercase from the start keeps what's shown here identical to what actually gets saved.
export const CREATOR_CATEGORIES = [
  'build in public',
  'coding',
  'ai tools',
  'startups',
  'indie hacking',
  'podcasts',
  'video',
  'music',
  'art and illustration',
  'writing',
  'game dev',
  'photography',
  'education and coaching',
  'fitness and wellness',
  'cooking',
  'comedy',
];
