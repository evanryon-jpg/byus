'use client';

// A single Help Center category — see app/help/page.js for the index/search and
// app/help/data.js for the content itself. Same expand/collapse accordion pattern as the
// homepage FAQ (app/components/FAQSection.jsx) so the interaction feels familiar rather
// than inventing a new one for this page alone.

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getCategoryBySlug } from '../data';

export default function HelpCategoryPage() {
  const { category: slug } = useParams();
  const category = getCategoryBySlug(slug);
  const [openIndex, setOpenIndex] = useState(0);

  if (!category) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-brand-ink/72">We couldn't find that help topic.</p>
        <Link href="/help" className="mt-4 inline-block font-semibold text-[#146359] hover:underline">
          ← Back to the Help Center
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/help" className="text-sm font-medium text-[#146359] hover:underline">
        ← Help Center
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#146359]/10 text-xl"
          aria-hidden="true"
        >
          {category.icon}
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight text-[#2B2420] sm:text-3xl">
            {category.title}
          </h1>
          <p className="text-sm text-brand-ink/65">{category.description}</p>
        </div>
      </div>

      <div className="mt-10 divide-y divide-brand-ink/10 border-y border-brand-ink/10">
        {category.articles.map((article, i) => {
          const open = openIndex === i;
          return (
            <div key={article.q}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-semibold text-[#2B2420]">{article.q}</span>
                <span
                  className={`shrink-0 text-brand-teal transition-transform ${open ? 'rotate-45' : ''}`}
                  aria-hidden="true"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </span>
              </button>
              {open && (
                <p className="pb-5 pr-8 text-sm leading-relaxed text-brand-ink/72">{article.a}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-10 rounded-2xl bg-[#146359]/5 px-5 py-4 text-center text-sm text-brand-ink/72">
        Didn't find your answer?{' '}
        <a href="mailto:evanryon@yahoo.com" className="font-semibold text-[#146359] hover:underline">
          Email evanryon@yahoo.com
        </a>{' '}
        and we'll help directly.
      </p>
    </div>
  );
}
