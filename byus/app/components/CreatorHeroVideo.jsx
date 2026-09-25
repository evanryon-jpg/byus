'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const VIDEO = '/videos/byus-creator-hero-v1.mp4';

export default function CreatorHeroVideo() {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const interacted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = () => {
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    setLoading(true);
    // No src exists in SSR or on initial hydration. preload="none" alone is
    // insufficient to guarantee zero video requests on mobile / reduced data.
    if (!video.getAttribute('src')) video.src = VIDEO;
    video.play()?.catch(() => setLoading(false));
  };

  useEffect(() => {
    const video = videoRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
    const connection = navigator.connection;
    let timer;
    let idle;
    let visible = false;
    const eligible = () => desktop.matches && !motion.matches &&
      connection && !connection.saveData && connection.effectiveType === '4g' &&
      (!Number.isFinite(connection.downlink) || connection.downlink >= 2);
    const maybeStart = () => {
      if (!interacted.current && visible && !document.hidden && eligible()) start();
    };
    const afterLoad = () => {
      // Give critical content time to paint; video never competes with initial load.
      timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) idle = window.requestIdleCallback(maybeStart);
        else maybeStart();
      }, 1500);
    };
    const stopIfNeeded = () => {
      if (document.hidden || !eligible()) video?.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) video?.pause();
    }, { threshold: 0.25 });
    observer.observe(containerRef.current);
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
    document.addEventListener('visibilitychange', stopIfNeeded);
    motion.addEventListener('change', stopIfNeeded);
    desktop.addEventListener('change', stopIfNeeded);
    connection?.addEventListener('change', stopIfNeeded);
    return () => {
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      window.removeEventListener('load', afterLoad);
      document.removeEventListener('visibilitychange', stopIfNeeded);
      motion.removeEventListener('change', stopIfNeeded);
      desktop.removeEventListener('change', stopIfNeeded);
      connection?.removeEventListener('change', stopIfNeeded);
      observer.disconnect();
    };
  }, []);

  return (
    <figure className="relative" aria-label="Creators at work and a ByUs example page">
      <div ref={containerRef} className="relative aspect-video overflow-hidden rounded-2xl border border-white/20 bg-[#0b2037] shadow-[0_24px_55px_-28px_rgba(0,0,0,0.9)]">
        <Image src="/images/byus-creator-hero-v1.webp" alt="A ceramic artist shaping a bowl in a sunlit pottery studio" fill sizes="(min-width: 1280px) 620px, (min-width: 1024px) 50vw, 100vw" className="object-cover" priority />
        <video ref={videoRef} muted playsInline loop preload="none"
          aria-label="Silent 10-second film of a potter and her example ByUs membership page"
          className={`absolute inset-0 h-full w-full object-cover motion-safe:transition-opacity motion-safe:duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}
          onPlaying={() => { setPlaying(true); setRevealed(true); setLoading(false); }}
          onPause={() => { setPlaying(false); setLoading(false); }}
          onError={() => { setFailed(true); setPlaying(false); setLoading(false); setRevealed(false); }}
        />
        <button type="button" disabled={loading}
          onClick={() => { interacted.current = true; if (playing) videoRef.current.pause(); else start(); }}
          aria-label={playing ? 'Pause creator film' : 'Play creator film'}
          className="absolute bottom-4 right-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 bg-[#08182d]/90 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-[#0f766e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-70">
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
          {loading ? 'Loading…' : playing ? 'Pause' : 'Play film · 10 sec'}
        </button>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs leading-relaxed text-[#dce8eb]/70">
        <span>For the conversations, the craft, and the community.</span>
        <span className="text-[#7fd9ce]">Your work. Your people.</span>
      </figcaption>
      {failed && <p role="status" className="mt-2 text-xs text-[#dce8eb]/70">The film couldn’t load. You can still explore the example pages below.</p>}
    </figure>
  );
}
