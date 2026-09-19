export default function CreatorWalkthrough() {
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
            Add your profile, create membership tiers, and preview the page your fans will see—all
            in under a minute.
          </p>
        </div>

        <div className="mx-auto mt-9 max-w-5xl overflow-hidden rounded-2xl border border-brand-ink/10 bg-[#0C1730] shadow-[0_28px_80px_-28px_rgba(13,32,58,0.5)] sm:rounded-3xl">
          <video
            className="block aspect-video w-full bg-[#0C1730]"
            controls
            playsInline
            preload="metadata"
            poster="/images/byus-video-poster.jpg"
            aria-label="A step-by-step demonstration of building a ByUs creator page"
          >
            <source src="/videos/byus-creator-page-demo.mp4" type="video/mp4" />
            Your browser does not support embedded video.
          </video>
        </div>

        <div className="mx-auto mt-6 max-w-4xl">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/55">
            What you&rsquo;ll see
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ['01', 'Add your profile', 'Photo, name, bio, and page details'],
              ['02', 'Build membership tiers', 'Set pricing and explain each benefit'],
              ['03', 'Preview the finished page', 'See exactly what fans will experience'],
            ].map(([number, title, detail]) => (
              <li
                key={number}
                className="flex items-start gap-3 rounded-xl border border-brand-ink/10 bg-white px-4 py-3 text-left shadow-sm"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs font-extrabold text-white">
                  {number}
                </span>
                <span>
                  <strong className="block text-sm text-[#172033]">{title}</strong>
                  <span className="mt-0.5 block text-xs leading-relaxed text-brand-ink/60">
                    {detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a
            href="/signup?role=creator"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-teal px-6 py-3 font-bold text-white shadow-[0_14px_30px_-16px_rgba(15,118,110,0.7)] transition hover:-translate-y-0.5 hover:bg-[#115E59]"
          >
            Join the founding creator waitlist
          </a>
          <a
            href="/demo"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-ink/15 bg-white px-6 py-3 font-bold text-[#172033] transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Explore the interactive demo
          </a>
        </div>
      </div>
    </section>
  );
}
