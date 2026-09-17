// Founding Creator waitlist count. Used for admin reporting, and by /api/waitlist itself
// while creator signup is paused (see that route's comment for why).
export async function getWaitlistCount(queryFn) {
  const result = await queryFn(`SELECT COUNT(*)::int AS count FROM founding_waitlist`);
  return result.rows[0].count;
}
