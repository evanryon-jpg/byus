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

// Downloadable MP4s (static renditions) of a signed-policy asset also need a signed
// token appended to the URL, the same way normal playback does. Mux's docs don't
// spell out a distinct audience claim for static-rendition/MP4 URLs the way they do
// for playback ("v"), thumbnails ("t"), and gifs ("g") -- their guide for enabling
// static MP4 renditions says only to "sign requests made for MP4 URLs" the same way
// as the playback guide, and their own SDK's audience enum has no separate value for
// it either. aud: "v" (via signPlaybackToken) is therefore reused rather than a
// distinct value -- if Mux ever rejects these tokens, this assumption is the first
// thing to check with Mux support. A longer default expiry than playback's 4h since
// a creator downloading their whole catalog may be sitting on a slow connection.
export function signDownloadToken(playbackId, { expiresIn = '6h' } = {}) {
  return signPlaybackToken(playbackId, { expiresIn });
}
