// A single Help Center category — see app/help/page.js for the index/search and
// app/help/data.js for the content itself.
//
// A server component prerendered at build time, one static page per category. This used
// to be a 'use client' page with no generateStaticParams, which made Next.js render it
// on demand for every single visit (Vercel served it "private, no-store", x-vercel-cache
// MISS, ~650ms TTFB on a cold function) even though its content only ever changes with a
// deploy — Speed Insights flagged it at 87. Now it's served straight from the CDN like
// /help itself, and only the accordion (HelpArticleList.jsx) hydrates on the client.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HELP_CATEGORIES, getCategoryBySlug } from '../data';
import HelpArticleList from './HelpArticleList';

// Every category is known at build time; any other slug is a plain 404 rather than an
// on-demand render.
export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_CATEGORIES.map((category) => ({ category: category.slug }));
}

// Per-category title/description/canonical. Without this, every category page inherited
// app/help/layout.js's canonical of /help, telling search engines they were all
// duplicates of the index page.
export function generateMetadata({ params }) {
  const category = getCategoryBySlug(params.category);
  if (!category) return {};
  return {
    title: `${category.title} — ByUs Help Center`,
    description: category.description,
    alternates: { canonical: `/help/${category.slug}` },
  };
}

export default function HelpCategoryPage({ params }) {
  const category = getCategoryBySlug(params.category);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/help" className="text-sm font-medium text-[#0F766E] hover:underline">
        ← Help Center
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0F766E]/10 text-xl"
          aria-hidden="true"
        >
          {category.icon}
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight text-[#172033] sm:text-3xl">
            {category.title}
          </h1>
          <p className="text-sm text-brand-ink/65">{category.description}</p>
        </div>
      </div>

      <HelpArticleList articles={category.articles} />

      <p className="mt-10 rounded-2xl bg-[#0F766E]/5 px-5 py-4 text-center text-sm text-brand-ink/70">
        Didn't find your answer?{' '}
        <a href="mailto:support@byusapp.com" className="font-semibold text-[#0F766E] hover:underline">
          Email support@byusapp.com
        </a>{' '}
        and we'll help directly.
      </p>
    </div>
  );
}
