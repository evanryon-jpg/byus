export const dynamic = 'force-dynamic';

// PATCH /api/me/password
// Changes the currently logged-in user's password. Requires the current
// password to be re-entered, same as the initial signup convention (bcrypt,
// via lib/auth.js) so we don't need any new hashing logic.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/auth';

export async function PATCH(request) {
  const session = getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Current and new password are both required.' },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }

  try {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [session.userId]);
    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const matches = await verifyPassword(currentPassword, user.password_hash);
    if (!matches) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, session.userId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('me/password PATCH failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not change your password. Try again.' },
      { status: 500 }
    );
  }
}
