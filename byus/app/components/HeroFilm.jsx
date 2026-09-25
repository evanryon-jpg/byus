'use client';

import { useEffect, useRef, useState } from 'react';

// The short homepage film (a potter at work, then her example ByUs page) that sits at the
// top of the hero's right column. 8 seconds, silent, ~490 KB, loops.
//
// The <video> is server-rendered with only a poster and NO src, so the first paint is a
// 44 KB still no matter what. The film itself is attached after hydration, and only when
// it makes sense to play it:
//   - prefers-reduced-motion: reduce -> never loads; the poster is the whole experience
//   - Save-Data on, or a 2G-class connection -> same, poster only
// While it's off-screen it's paused (no point decoding a loop nobody can see), and there's
// a visible pause/play button because anything that moves on its own for more than five
// seconds needs one (WCAG 2.2.2).
//
// The file fades in from dark over its first half-second so the loop point is seamless.
// That fade is wrong for the very first play, though -- it would flash from the bright
// poster down to black -- so the first play starts at 0.5s, where the frame matches the
// poster exactly. Every later loop starts from 0 and gets the fade.
const FILM_SRC = '/videos/byus-homepage-film-20260925b.mp4';
const POSTER_SRC = '/images/byus-homepage-film-poster.webp';
const FIRST_PLAY_OFFSET = 0.5;

function shouldSkipMotion() {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  const connection = navigator.connection;
  if (connection?.saveData) return true;
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return true;
  return false;
}

export default function HeroFilm() {
  const videoRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const userPausedRef = useRef(false);

  useEffect(() => {
    if (shouldSkipMotion()) return undefined;
    setEnabled(true);
    return undefined;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return undefined;

    // React doesn't reliably reflect the `muted` prop onto the element before the first
    // play() call, and browsers only allow autoplay for muted video -- set it directly.
    video.muted = true;

    const seekPastFade = () => {
      if (video.currentTime < FIRST_PLAY_OFFSET) video.currentTime = FIRST_PLAY_OFFSET;
    };
    if (video.readyState >= 1) seekPastFade();
    else video.addEventListener('loadedmetadata', seekPastFade, { once: true });

    const tryPlay = () => {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => setPaused(true)); // autoplay blocked: poster stays, button offers play
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      tryPlay();
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!userPausedRef.current) tryPlay();
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [enabled]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-[#0b2037] shadow-[0_24px_55px_-28px_rgba(0,0,0,0.9)]">
      <video
        ref={videoRef}
        className="block aspect-video w-full object-cover"
        poster={POSTER_SRC}
        src={enabled ? FILM_SRC : undefined}
        muted
        loop
        playsInline
        preload={enabled ? 'auto' : 'none'}
        disablePictureInPicture
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={() => setEnabled(false)} // can't decode it here: fall back to the poster, drop the button
        aria-label="Short film: a ceramic artist shaping a bowl on a pottery wheel, then her example ByUs creator page offering an $8 a month membership"
      />
      {enabled && (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={paused ? 'Play the film' : 'Pause the film'}
          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#061321]/70 text-white backdrop-blur-sm transition hover:bg-[#061321]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67d8dc]"
        >
          {paused ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M3 1.5v11l9-5.5-9-5.5z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <rect x="2.5" y="1.5" width="3" height="11" rx="0.75" />
              <rect x="8.5" y="1.5" width="3" height="11" rx="0.75" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
