// Plain data module, deliberately with NO 'use client' directive. FAQSection.jsx (the
// interactive accordion) and app/page.js (a Server Component, for FAQPage JSON-LD) both
// import this same array as their one source of truth. It has to live outside
// FAQSection.jsx: importing a named export from a 'use client' module into a Server
// Component puts it behind React's client-reference boundary, and calling .map() on
// that from server code fails at build time ("map is on the client"). Keeping the data
// in its own plain module sidesteps that boundary entirely.
export const FAQS = [
  {
    q: 'Can creators sign up and connect Stripe now?',
    a: "New creator signups are temporarily paused while we finish up some account setup on our end — join the waitlist and we'll email you as soon as it reopens. Fans can sign up and subscribe as normal in the meantime. Creating a ByUs account is free either way; Stripe separately reviews each connected account and may request verification information before enabling its payments or payouts.",
  },
  {
    q: 'How does the platform fee work?',
    a: "ByUs's fee is evaluated fresh each calendar month — it's never locked in permanently either way. Every creator starts the month at 13%; earn $2,000 or more on ByUs within that month and the fee automatically drops to 10% for the rest of it, no action needed. A new month always starts back at 13% until $2,000 is crossed again, so a slower month simply means the standard rate, not a penalty. Creators keep 87% (90% once discounted) of each standard domestic payment, paid straight into the creator's own Stripe account. Standard domestic processing is included; currency conversion, instant payouts, taxes, disputes, and exceptional processor costs may apply separately and will be disclosed where applicable.",
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
    a: "No. Setting up a page is free, with no listing or setup fee. ByUs only makes money when a creator gets paid: the all-in fee is 13%, dropping to 10% for any month with at least $2,000 in ByUs earnings and returning to 13% the following month if it doesn't happen again. The first 100 founding creators lock in 10% forever, no threshold required.",
  },
  {
    q: 'Can a creator offer more than one tier?',
    a: 'Yes — creators can set up multiple monthly tiers, each with its own name, price, and description, so fans can pick the level that fits them.',
  },
  {
    q: 'Is my payment information safe?',
    a: "All payments and payouts run through Stripe. ByUs never sees or stores card numbers — that's true for what a fan pays and for what a creator gets paid out.",
  },
  {
    q: 'Can creators connect Discord or Telegram?',
    a: "Yes. A creator can link a Discord server and/or a private Telegram group in Settings, and ByUs automatically grants a subscriber the matching Discord role or Telegram access the moment they join — then removes it automatically if they ever cancel. It's optional and separate from a creator's ByUs page, which stays the source of truth either way.",
  },
];
