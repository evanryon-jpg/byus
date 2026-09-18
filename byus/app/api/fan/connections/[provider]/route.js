export const dynamic = 'force-dynamic';

// DELETE /api/fan/connections/[provider]
// Disconnects the fan's Discord or Telegram account. Revokes any bot-managed access
// first (see lib/platform-sync.js), while the connection row this needs still exists,
// then removes the row itself -- disconnecting is an explicit "stop managing this for
// me" signal, not just forgetting the link.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { revokeProviderAccessForFan } from '@/lib/platform-sync';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function DELETE(request, { params }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans have connected accounts.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('connection-disconnect', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const provider = params.provider;
  if (provider !== 'discord' && provider !== 'telegram') {
    return NextResponse.json({ error: 'Unknown provider.' }, { status: 400 });
  }

  await revokeProviderAccessForFan(session.userId, provider);
  await query(`DELETE FROM platform_connections WHERE user_id = $1 AND provider = $2`, [session.userId, provider]);

  return NextResponse.json({ ok: true });
}
