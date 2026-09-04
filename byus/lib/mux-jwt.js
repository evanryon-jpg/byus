// Signs Mux "signed playback" tokens: short-lived JWTs that prove a specific viewer
// is allowed to watch a specific gated (playback_policy: 'signed') stream or replay.
// Mux verifies these against the signing key registered on your account (Mux
// dashboard -> Settings -> Signing Keys) -- the private key itself never leaves this
// server, only a token derived from it, freshly minted per request after we've
// already checked the viewer has an active subscription.
import jwt from 'jsonwebtoken';

export function signPlaybackToken(playbackId, { expiresIn = '4h' } = {}) {
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const privateKey = process.env.MUX_SIGNING_KEY_PRIVATE;
  if (!keyId || !privateKey) {
    throw new Error('MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE are not set.');
  }
  // Mux hands out the private key base64-encoded (to survive being pasted into an
  // env var); jsonwebtoken needs the actual PEM.
  const pem = Buffer.from(privateKey, 'base64').toString('utf8');
  return jwt.sign(
    { sub: playbackId, aud: 'v' }, // aud "v" = video playback (vs. thumbnail/storyboard/gif tokens)
    pem,
    { algorithm: 'RS256', keyid: keyId, expiresIn }
  );
}
