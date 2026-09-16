'use client';

import Script from 'next/script';

// Same Mux Player web component as LivePlayer, just for a pre-recorded (on-demand)
// video attached to a post instead of a live stream: stream-type="on-demand" instead
// of "live", visible controls instead of forced autoplay (a feed can have several of
// these on screen at once — autoplaying all of them would be bad for everyone's data
// and everyone's ears), and a poster frame Mux generates automatically from the video
// itself. next/script dedupes by src, so this loads the same CDN bundle LivePlayer
// already loads instead of fetching it twice on a page that has both.
export default function PostVideoPlayer({ playbackId, playbackToken }) {
  if (!playbackId || !playbackToken) return null;

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@mux/mux-player@3" strategy="afterInteractive" />
      <mux-player
        stream-type="on-demand"
        playback-id={playbackId}
        playback-token={playbackToken}
        controls
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
