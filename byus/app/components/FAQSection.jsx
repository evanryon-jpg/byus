'use client';

import { useState } from 'react';

// A skeptical first-time visitor has a short, predictable list of objections
// before they'll trust a payments product enough to sign up -- this answers
// those directly instead of making them dig through Terms of Service to find
// out. Client component only for the expand/collapse interaction; the actual
// answers are plain text so search engines and no-JS visitors still get them.
const FAQS = [
  {
    q: 'How does the platform fee work?',
    a: "Creators keep 90% of every payment a fan sends, paid straight into the creator's own Stripe account. ByUs's fee starts at 10% and drops permanently to 7% once a creator's lifetime earnings on ByUs pass $2,000 — no extra processing, currency conversion, or payout charges stacked on top of that.",
  },
  {
    q: 'When and how do creators get paid?',
    a: "Directly. Each creator connects their own Stripe Express account once, and payouts land there on Stripe's standard schedule — there's no separate ByUs payout process, holding period, or minimum to reach first.",
  },
  {
    q: 'Is it easy for a fan to cancel?',
    a: "Yes. Every subscription is month-to-month with no contract. A fan can cancel anytime from their dashboard, and keeps access through the end of the period they already paid for — no penalty, no call required.",
  },
  {
    q: 'What happens to my access if I cancel?',
    a: 'Subscriber-only posts and perks turn off at the end of the current billing period. Anything a creator has posted publicly stays visible either way.',
  },
  {
    q: 'Does it cost anything to become a creator?',
    a: "No. Setting up a page is free, with no listing or setup fee. ByUs only makes money through its platform fee (10%, dropping to 7% for good as a creator grows), and only when a creator actually gets paid.",
  },
  {
    q: 'Can a creator offer more than one tier?',
    a: 'Yes — creators can set up multiple monthly tiers, each with its own name, price, and description, so fans can pick the level that fits them.',
  },
  {
    q: 'Is my payment information safe?',
    a: "All payments and payouts run through Stripe. ByUs never sees or stores card numbers — that's true for what a fan pays and for what a creator gets paid out.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section>
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="text-center font-display text-3xl font-semibold text-[#1A1A1A]">
          Questions, answered
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-black/55">
          The things people usually want to know before they connect a card or a bank
          account.
        </p>

        <div className="mt-12 divide-y divide-black/10 border-y border-black/10">
          {FAQS.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? -1 : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-semibold text-[#1A1A1A]">{item.q}</span>
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
                  <p className="pb-5 pr-8 text-sm leading-relaxed text-black/60">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
