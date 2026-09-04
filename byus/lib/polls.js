// Shared helpers for the simple poll feature. A poll is just a regular post with a
// `poll_options` jsonb array attached (the post's `body` doubles as the question) and
// a `poll_votes` table holding one row per (post, fan) -- kept this thin on purpose so
// polls stay "a kind of post," not a whole separate feature with its own permissions,
// gating rules, or feed.

import { query } from './db';

// post_id -> { optionIndex: voteCount } for every poll among the given post ids.
export async function getPollVoteCounts(postIds) {
  if (!postIds || postIds.length === 0) return {};
  const result = await query(
    `SELECT post_id, option_index, COUNT(*)::int AS votes
     FROM poll_votes WHERE post_id = ANY($1::uuid[])
     GROUP BY post_id, option_index`,
    [postIds]
  );
  const map = {};
  for (const row of result.rows) {
    if (!map[row.post_id]) map[row.post_id] = {};
    map[row.post_id][row.option_index] = row.votes;
  }
  return map;
}

// post_id -> the option index this fan voted for, for every poll among the given post
// ids. Empty map (never throws) when there's no logged-in fan to look up.
export async function getMyPollVotes(postIds, fanId) {
  if (!postIds || postIds.length === 0 || !fanId) return {};
  const result = await query(
    `SELECT post_id, option_index FROM poll_votes
     WHERE post_id = ANY($1::uuid[]) AND fan_id = $2`,
    [postIds, fanId]
  );
  const map = {};
  for (const row of result.rows) map[row.post_id] = row.option_index;
  return map;
}

// Shapes one post's poll data for a JSON response, or returns null for a post that
// isn't a poll at all -- callers can spread this straight onto the post object.
export function buildPollPayload(post, countsByOptionIndex, myVoteIndex) {
  if (!post.poll_options) return null;
  const options = post.poll_options;
  const votes = options.map((_, i) => (countsByOptionIndex && countsByOptionIndex[i]) || 0);
  return {
    options,
    votes,
    myVote: myVoteIndex === undefined ? null : myVoteIndex,
  };
}
