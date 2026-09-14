// Historical Founding Creator waitlist count. The public waitlist now redirects to normal
// creator signup, but this loader remains available for admin reporting and the records
// collected before signup reopened.
export async function getWaitlistCount(queryFn) {
  const result = await queryFn(`SELECT COUNT(*)::int AS count FROM founding_waitlist`);
  return result.rows[0].count;
}
