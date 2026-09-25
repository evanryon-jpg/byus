'use client';

// The expand/collapse Q&A list for one Help Center category. Split out of
// app/help/[category]/page.js so the page itself can be a server component that's
// prerendered at build time (see generateStaticParams there) — only this small
// interactive piece ships as client JavaScript, and it receives just this category's
// articles as props instead of importing the whole Help Center data module. Same
// accordion pattern as the homepage FAQ (app/components/FAQSection.jsx).

import { useState } from 'react';

export default function HelpArticleList({ articles }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="mt-10 divide-y divide-brand-ink/10 border-y border-brand-ink/10">
      {articles.map((article, i) => {
        const open = openIndex === i;
        return (
          <div key={article.q}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? -1 : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="font-semibold text-[#172033]">{article.q}</span>
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
              <p className="pb-5 pr-8 text-sm leading-relaxed text-brand-ink/70">{article.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
