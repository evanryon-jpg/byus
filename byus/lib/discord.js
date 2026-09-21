// Discord integration: OAuth connect flow for fans (lib/discord.js only ever holds an
// access token in memory long enough to read the fan's Discord user id -- it's never
// stored) plus bot-token calls to grant/revoke the subscriber role once a fan has
// joined a creator's server and connected their account. See lib/platform-sync.js for
// where grant/revoke actually get called from, and lib/telegram.js for the equivalent
// on the Telegram side.

const DISCORD_API = 'https://discord.com/api/v10';

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

export function isDiscordConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && BOT_TOKEN);
}

// state is a short-lived signed JWT (see app/api/auth/discord/start/route.js) so the
// callback can trust which ByUs fan initiated this without a server-side session table.
export function buildDiscordAuthorizeUrl(redirectUri, state) {
  if (!CLIENT_ID) throw new Error('DISCORD_CLIENT_ID is not set.');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(code, redirectUri) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Discord OAuth is not configured.');
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Discord token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json(); // { access_token, token_type, expires_in, refresh_token, scope }
}

export async function getDiscordUser(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Discord user lookup failed (${res.status}): ${await res.text()}`);
  }
  const user = await res.json();
  return { id: user.id, username: user.global_name || user.username };
}

// Adds the creator's configured subscriber role to a fan who has already joined the
// creator's Discord server. Discord's PUT here is idempotent (re-adding a role the
// member already has is a no-op 204), so this is safe to call more than once. Returns
// false (not thrown) for the expected "fan hasn't joined the server yet" case (404 —
// Unknown Member) so callers can distinguish "nothing to do yet" from a real failure.
export async function addSubscriberRole({ guildId, roleId, discordUserId }) {
  if (!BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is not set.');
  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: 'PUT', headers: { Authorization: `Bot ${BOT_TOKEN}` } }
  );
  if (res.status === 204) return true;
  if (res.status === 404) return false; // fan hasn't joined the guild yet
  throw new Error(`Discord add-role failed (${res.status}): ${await res.text()}`);
}

export async function removeSubscriberRole({ guildId, roleId, discordUserId }) {
  if (!BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is not set.');
  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN}` } }
  );
  if (res.status === 204) return true;
  if (res.status === 404) return false; // already not in the guild / doesn't have the role
  throw new Error(`Discord remove-role failed (${res.status}): ${await res.text()}`);
}

// Read-only check of a member's CURRENT roles, straight from Discord rather than
// trusting that an earlier grant/revoke call actually landed. Used by the platform-access
// reconciliation cron (see lib/platform-sync.js) to catch drift from a grant/revoke that
// silently failed -- a rate limit, a brief Discord outage, the bot temporarily missing
// permissions -- since those calls are deliberately best-effort and never retried inline.
// Returns null if the fan isn't (or is no longer) a member of the guild at all.
export async function getGuildMemberRoles({ guildId, discordUserId }) {
  if (!BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is not set.');
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Discord get-member failed (${res.status}): ${await res.text()}`);
  const member = await res.json();
  return member.roles || [];
}
