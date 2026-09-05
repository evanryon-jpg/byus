export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="font-display text-6xl font-semibold text-brand-teal">404</span>
      <h1 className="mt-4 font-display text-2xl font-semibold text-[#2B2420]">
        This page doesn&rsquo;t exist
      </h1>
      <p className="mt-3 text-brand-ink/55">
        The page you&rsquo;re looking for was moved, renamed, or never existed.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <a
          href="/"
          className="rounded-full bg-brand-teal px-6 py-2.5 font-semibold text-white hover:bg-[#0f4d45]"
        >
          Go home
        </a>
        <a
          href="/browse"
          className="rounded-full border border-brand-teal px-6 py-2.5 font-semibold text-brand-teal hover:bg-brand-teal/5"
        >
          Browse creators
        </a>
      </div>
    </div>
  );
}
