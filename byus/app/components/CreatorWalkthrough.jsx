'use client';

import { useRef } from 'react';

// Timestamps below are pulled straight from the walkthrough's own caption track
// (public/videos/byus-creator-walkthrough-final-20260921-en.vtt) -- each one is the
// start of the caption cue where that step's narration begins, so "Get paid, with
// guidance" jumps to 1:24, right where the video actually starts talking about Stripe
// payouts. If the video is ever re-cut, re-check these against the new .vtt rather
// than guessing -- a wrong jump point is worse than no jump point at all.
const STEPS = [
  ['01', 'Add your profile', 'Photo, name, bio, social links, and page details', 3],
  ['02', 'Build membership tiers', 'Pricing from $8, benefits, and a live fan preview', 16],
  ['03', 'Publish and sell', 'Posts, imports, tips, downloads, and live streaming', 35],
  ['04', 'Grow your community', 'Discord and Telegram sync, notifications, and analytics', 60],
  ['05', 'Get paid, with guidance', 'Stripe payouts, yearly reporting, and the Page Coach', 84],
  ['06', 'Preview and publish', 'See the finished page, then share it with your audience', 98],
];

export default function CreatorWalkthrough() {
  const videoRef = useRef(null);

  // Two things have to happen on click: seek to the timestamp, and start playback.
  // They can't share one code path. Seeking needs metadata (duration/keyframes), which
  // preload="metadata" usually has ready by the time someone clicks -- but if it isn't
  // yet, we have to wait for the `loadedmetadata` event before setting currentTime.
  // Starting playback is different: Safari (and some mobile browsers) only allow
  // video.play() to succeed when it's called synchronously inside the click handler
  // itself. Call it from inside that async `loadedmetadata` callback instead -- even a
  // few milliseconds later -- and the browser no longer credits it as a direct result
  // of the tap, and silently blocks it. So play() always fires first, synchronously,
  // right here; the seek is applied whenever metadata is actually ready, even if that's
  // a beat after playback has already started.
  const jumpTo = (seconds) => {
    const video = videoRef.current;
    if (!video) return;

    video.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const applySeek = () => {
      video.currentTime = seconds;
    };

    if (video.readyState >= 1) {
      applySeek();
    } else {
      video.addEventListener('loadedmetadata', applySeek, { once: true });
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Playback can still be blocked (e.g. reduced-data mode); the seek above still
        // lands once metadata loads, so the scrubber and poster frame stay correct.
      });
    }
  };

  return (
    <section
      id="creator-walkthrough"
      aria-labelledby="creator-walkthrough-title"
      className="relative scroll-mt-20 overflow-hidden bg-[#F8FAFC] px-6 py-16 sm:py-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-brand-teal/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-teal">
            See ByUs in action
          </p>
          <h2
            id="creator-walkthrough-title"
            className="mt-3 font-display text-3xl font-semibold leading-tight text-[#172033] sm:text-5xl"
          >
            See how quickly your page comes together
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-brand-ink/70 sm:text-lg">
            Add your profile, create membership tiers, and explore the tools that help you earn,
            publish, and manage your community.
          </p>
        </div>

        <div className="mx-auto mt-9 max-w-5xl overflow-hidden rounded-2xl border border-brand-ink/10 bg-[#0C1730] shadow-[0_28px_80px_-28px_rgba(13,32,58,0.5)] sm:rounded-3xl">
          <video
            ref={videoRef}
            className="block aspect-video w-full bg-[#0C1730]"
            controls
            playsInline
            preload="metadata"
            poster="/images/byus-video-poster-v2.jpg"
            aria-label="A step-by-step demonstration of building a ByUs creator page"
          >
            <source src="/videos/byus-creator-walkthrough-final-20260921.mp4" type="video/mp4" />
            <track
              kind="captions"
              src="/videos/byus-creator-walkthrough-final-20260921-en.vtt"
              srcLang="en"
              label="English"
            />
            Your browser does not support embedded video.
          </video>
        </div>

        <div className="mx-auto mt-6 max-w-4xl">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/55">
            What you&rsquo;ll see <span className="normal-case text-brand-ink/40">(tap a step to jump there)</span>
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {STEPS.map(([number, title, detail, seconds]) => (
              <li key={number}>
                <button
                  type="button"
                  onClick={() => jumpTo(seconds)}
                  aria-label={`Jump to "${title}" (${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}) in the walkthrough video`}
                  className="group flex w-full items-start gap-3 rounded-xl border border-brand-ink/10 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-teal/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs font-extrabold text-white transition group-hover:brightness-110">
                    {number}
                  </span>
                  <span>
                    <strong className="block text-sm text-[#172033]">{title}</strong>
                    <span className="mt-0.5 block text-xs leading-relaxed text-brand-ink/60">
                      {detail}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-7 flex justify-center">
          <a
            href="/demo"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-teal px-6 py-3 font-bold text-white shadow-[0_14px_30px_-16px_rgba(15,118,110,0.7)] transition hover:-translate-y-0.5 hover:bg-[#115E59]"
          >
            Explore the interactive demo
          </a>
        </div>
      </div>
    </section>
  );
}
