'use client';

import { useEffect, useRef, useState } from 'react';

// The short homepage film (a potter at work, then her example ByUs page) that sits at the
// top of the hero's right column. ~7 seconds, silent, ~480 KB. Plays once, then stops on
// its last frame (the example creator page) with a replay button.
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
// The file (…-20260925c) has no fade at either end: it opens on exactly the poster frame
// and ends on the fully lit end card. The earlier cut faded in/out of black so it could
// loop; phones stopped on that black last frame, and seeking back after 'ended' isn't
// reliable on iOS. Ending on the end card in the file itself means every browser simply
// stops there -- no seeking needed.
const FILM_SRC = '/videos/byus-homepage-film-20260925c.mp4';
const POSTER_SRC = '/images/byus-homepage-film-poster.webp';

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
  const [finished, setFinished] = useState(false);
  const userPausedRef = useRef(false);
  const finishedRef = useRef(false);

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
          // Once it has played through, it stays on the end card until someone taps replay.
          if (!userPausedRef.current && !finishedRef.current) tryPlay();
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [enabled]);

  const handleEnded = () => {
    finishedRef.current = true;
    setFinished(true);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (finishedRef.current) {
      finishedRef.current = false;
      setFinished(false);
      userPausedRef.current = false;
      video.currentTime = 0;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
      return;
    }
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
        playsInline
        preload={enabled ? 'auto' : 'none'}
        disablePictureInPicture
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={handleEnded}
        onError={() => setEnabled(false)} // can't decode it here: fall back to the poster, drop the button
        aria-label="Short film: a ceramic artist shaping a bowl on a pottery wheel, then her example ByUs creator page offering an $8 a month membership"
      />
      {enabled && (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={finished ? 'Replay the film' : paused ? 'Play the film' : 'Pause the film'}
          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#061321]/70 text-white backdrop-blur-sm transition hover:bg-[#061321]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67d8dc]"
        >
          {finished ? (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 8a5.5 5.5 0 1 0 1.7-3.97" />
              <path d="M2.5 2.5v3h3" />
            </svg>
          ) : paused ? (
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
