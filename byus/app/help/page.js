'use client';

// The Help Center's front door: a search box over every article (see data.js) plus a
// grid of the topic categories to browse by. Kept as a single client component rather
// than routing search through the server — the whole knowledge base is a few dozen short
// Q&As, small enough to ship as static content and filter instantly in the browser with
// no loading state needed.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { HELP_CATEGORIES, ALL_HELP_ARTICLES } from './data';

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!trimmed) return [];
    return ALL_HELP_ARTICLES.filter((article) => {
      const haystack = `${article.q} ${article.a}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [trimmed]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-[#146359]">
        Help Center
      </p>
      <h1 className="mt-2 text-center font-display text-3xl font-semibold leading-tight text-[#2B2420] sm:text-4xl">
        What can we help with?
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-center text-brand-ink/68">
        Answers for creators and fans, covering payments, posts, and everything in between.
      </p>

      <div className="relative mx-auto mt-8 max-w-xl">
        <span
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/50"
          aria-hidden="true"
        >
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for an answer — try “cancel” or “fees”"
          aria-label="Search the Help Center"
          className="w-full rounded-full border border-brand-ink/10 bg-brand-paper py-3.5 pl-11 pr-5 text-sm shadow-sm placeholder:text-brand-ink/55 focus:border-[#146359]/40 focus:outline-none"
        />
      </div>

      {trimmed ? (
        <div className="mt-10">
          <p className="text-sm text-brand-ink/65">
            {results.length === 0
              ? `No results for "${query.trim()}"`
              : `${results.length} result${results.length === 1 ? '' : 's'} for "${query.trim()}"`}
          </p>
          <div className="mt-4 divide-y divide-brand-ink/10 border-y border-brand-ink/10">
            {results.map((article, i) => (
              <SearchResult key={`${article.categorySlug}-${i}`} article={article} />
            ))}
          </div>
          {results.length === 0 && <ContactFallback />}
        </div>
      ) : (
        <>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {HELP_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/help/${category.slug}`}
                className="group rounded-2xl border border-brand-ink/5 bg-brand-paper p-5 transition-colors hover:border-[#146359]/25"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#146359]/10 text-lg"
                  aria-hidden="true"
                >
                  {category.icon}
                </span>
                <h2 className="mt-3 font-semibold text-[#2B2420] group-hover:text-[#146359]">
                  {category.title}
                </h2>
                <p className="mt-1 text-sm text-brand-ink/65">{category.description}</p>
                <p className="mt-3 text-xs font-medium text-brand-ink/55">
                  {category.articles.length} article{category.articles.length === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </div>
          <ContactFallback />
        </>
      )}
    </div>
  );
}

function SearchResult({ article }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <span>
          <span className="block font-semibold text-[#2B2420]">{article.q}</span>
          <Link
            href={`/help/${article.categorySlug}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-block text-xs font-medium text-[#146359] hover:underline"
          >
            {article.categoryTitle}
          </Link>
        </span>
        <span
          className={`mt-1 shrink-0 text-brand-teal transition-transform ${open ? 'rotate-45' : ''}`}
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </span>
      </button>
      {open && <p className="mt-2 pr-8 text-sm leading-relaxed text-brand-ink/72">{article.a}</p>}
    </div>
  );
}

function ContactFallback() {
  return (
    <p className="mt-10 rounded-2xl bg-[#146359]/5 px-5 py-4 text-center text-sm text-brand-ink/72">
      Still stuck?{' '}
      <a href="mailto:evanryon@yahoo.com" className="font-semibold text-[#146359] hover:underline">
        Email evanryon@yahoo.com
      </a>{' '}
      and we'll help directly.
    </p>
  );
}
