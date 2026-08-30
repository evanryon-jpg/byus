'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="font-display text-6xl font-semibold text-brand-clay">Oops</span>
      <h1 className="mt-4 font-display text-2xl font-semibold text-[#1A1A1A]">
        Something went wrong
      </h1>
      <p className="mt-3 text-black/55">
        That&rsquo;s on us. Try again, or head back home if it keeps happening.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button
          onClick={reset}
          className="rounded-full bg-brand-teal px-6 py-2.5 font-semibold text-white hover:bg-[#0f4d45]"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-full border border-brand-teal px-6 py-2.5 font-semibold text-brand-teal hover:bg-brand-teal/5"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
