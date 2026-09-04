'use client';

import Script from 'next/script';

// Mux Player ships as a web component (a plain custom element), loaded from a CDN
// rather than an npm dependency -- one <script> tag and then <mux-player> just works
// as a DOM element, no React wrapper library needed. playbackToken is the short-lived
// signed token the API already checked the viewer's subscription before handing out;
// without it Mux simply won't play a signed-policy stream.
export default function LivePlayer({ playbackId, playbackToken }) {
  if (!playbackId || !playbackToken) return null;

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@mux/mux-player@3" strategy="afterInteractive" />
      <mux-player
        stream-type="live"
        playback-id={playbackId}
        playback-token={playbackToken}
        autoplay="muted"
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: '1rem',
          overflow: 'hidden',
          display: 'block',
        }}
      />
    </>
  );
}
