// Sends the "Welcome to ByUs" email (lib/email.js sendCreatorWelcomeEmail) exactly once
// per creator account. Called right after every path that can create a creator:
//   - app/api/auth/signup/route.js          (email + password)
//   - app/api/auth/google/callback/route.js (new Google account)
//   - app/api/auth/apple/callback/route.js  (new Apple account)
//   - app/api/me/become-creator/route.js    (a fan upgrading)
//
// "Once" is enforced in the database, not by the callers: users.creator_welcome_sent_at is
// claimed with a conditional UPDATE before sending, so a retried request or a double click
// can't send it twice. If the send itself fails, the claim is released so a later call can
// try again. Existing creators were backfilled when the column was added, so nobody who
// already has a page gets a surprise welcome.
//
// The founding spot is read AFTER the account exists: the claim_creator_founding_spot
// trigger on users is what links a waitlist reservation to the new account, so by the time
// this runs, founding_reservations.creator_id already points at them if they have a spot.
//
// Best-effort by design -- it never throws. A welcome email must never be the reason an
// account creation fails.

import { query } from '@/lib/db';
import { sendCreatorWelcomeEmail } from '@/lib/email';

export async function sendCreatorWelcomeOnce(userId) {
  if (!userId) return;
  let claimed = false;
  try {
    const claim = await query(
      `UPDATE users SET creator_welcome_sent_at = now()
       WHERE id = $1 AND role = 'creator' AND creator_welcome_sent_at IS NULL
       RETURNING email, display_name`,
      [userId]
    );
    const user = claim.rows[0];
    if (!user) return;
    claimed = true;

    const spotResult = await query(
      'SELECT spot_number FROM founding_reservations WHERE creator_id = $1',
      [userId]
    );
    const appUrl = process.env.APP_URL || 'https://byusapp.com';
    await sendCreatorWelcomeEmail(user.email, {
      displayName: user.display_name,
      foundingSpot: spotResult.rows[0]?.spot_number || null,
      dashboardUrl: `${appUrl}/creator/dashboard`,
    });
  } catch (err) {
    console.error('Creator welcome email failed (continuing):', err);
    if (claimed) {
      await query('UPDATE users SET creator_welcome_sent_at = NULL WHERE id = $1', [userId]).catch(() => {});
    }
  }
}
