'use client';

import { useState } from 'react';
import { FAQS } from './faqs-data';

// A skeptical first-time visitor has a short, predictable list of objections
// before they'll trust a payments product enough to sign up -- this answers
// those directly instead of making them dig through Terms of Service to find
// out. Client component only for the expand/collapse interaction; the actual
// answers are plain text so search engines and no-JS visitors still get them.
// FAQS itself lives in ./faqs-data.js (a plain, non-'use client' module) so
// app/page.js can also import it for FAQPage JSON-LD without crossing a client
// boundary -- one source of truth, so the schema Google sees can never drift out of
// sync with the accordion text a visitor actually reads.
export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center font-display text-3xl font-semibold text-[#172033]">
          Questions, answered
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-brand-ink/70">
          The things people usually want to know before they connect a card or a bank
          account.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {FAQS.map((item, i) => {
            const open = openIndex === i;
            return (
              <div
                key={item.q}
                className={`rounded-2xl border bg-brand-paper transition-colors duration-200 ${
                  open ? 'border-brand-teal/30 shadow-sm' : 'border-brand-ink/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? -1 : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-semibold text-[#172033]">{item.q}</span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                      open ? 'rotate-45' : ''
                    }`}
                    aria-hidden="true"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </span>
                </button>
                {/* grid-template-rows 0fr -> 1fr is what actually makes this "slide" -- it
                    animates smoothly to and from an unknown content height with no JS
                    scrollHeight measurement, and (unlike the old `{open && <p>}`) the answer
                    stays mounted the whole time, just visually collapsed to zero rows. That
                    also means a screen reader or no-JS visitor still gets every answer in the
                    DOM, not only whichever one happens to be open. */}
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                  style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm leading-relaxed text-brand-ink/70">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
