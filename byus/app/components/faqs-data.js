// Plain data module, deliberately with NO 'use client' directive. FAQSection.jsx (the
// interactive accordion) and app/page.js (a Server Component, for FAQPage JSON-LD) both
// import this same array as their one source of truth. It has to live outside
// FAQSection.jsx: importing a named export from a 'use client' module into a Server
// Component puts it behind React's client-reference boundary, and calling .map() on
// that from server code fails at build time ("map is on the client"). Keeping the data
// in its own plain module sidesteps that boundary entirely.
//
// Answers are written in ByUs's own voice (contractions, direct address, a little
// personality) rather than a formal support-doc tone -- but every number, threshold,
// and caveat below is worded to match the same facts the old copy stated, just said
// like a person would say them. This is fee/payments information someone reads right
// before connecting a card or a bank account, so voice is seasoning here, never at the
// expense of a claim being exact or complete.
export const FAQS = [
  {
    q: 'What is ByUs?',
    a: 'ByUs (byusapp.com) is where fans pay creators directly — monthly memberships, no middleman weirdness. Quick disclaimer since people ask: we’re a standalone, independent company, not affiliated with Brigham Young University (BYU) or anyone else, and no, "ByUs" isn’t a typo of "by us." Creators keep 87–90% of every subscription payment, paid straight into their own Stripe account.',
  },
  {
    q: 'Can creators sign up and connect Stripe now?',
    a: "New creator accounts are temporarily paused. Join the free waitlist and we'll email you when signups reopen. A waitlist entry does not create a creator account, reserve a founding spot, or lock in a rate. Fans, you're all set: sign up and subscribe as normal in the meantime. Creating a ByUs account is free either way; Stripe separately reviews every connected account and may ask for verification info before it'll turn on payments or payouts.",
  },
  {
    q: 'How does the platform fee work?',
    a: "ByUs's standard all-in platform fee is 13% of each payment. The first 100 creator accounts lock in a 10% founding rate for good, with no earnings requirement. Standard domestic payment processing is included, and the rest is paid straight into the creator's connected Stripe account. Currency conversion, instant payouts, taxes, disputes, or unusual processor costs may apply separately, and we'll spell those out when they do.",
  },
  {
    q: 'When and how do creators get paid?',
    a: "Straight to you, no detours. Connect your own Stripe Express account once, and every payout lands there on Stripe's normal schedule — no separate ByUs payout process, no holding period, no minimum you have to hit first.",
  },
  {
    q: 'Is it easy for a fan to cancel?',
    a: "Painfully easy, honestly — in a good way. Every subscription is month-to-month, no contracts hiding anywhere. Cancel anytime from your dashboard and you'll keep access through the end of the period you already paid for. No penalty, no guilt-trip phone call required.",
  },
  {
    q: 'What happens to my access if I cancel?',
    a: "Subscriber-only posts and perks switch off once your current billing period wraps up — you don't lose anything you already paid for mid-stream. Anything the creator's posted publicly is still there either way.",
  },
  {
    q: 'Does it cost anything to become a creator?',
    a: "Nope — setting up your page costs nothing, with zero listing fees and zero setup fees. We only make money when you do. The standard all-in fee is 13%, while the first 100 founding creators lock in a 10% rate forever.",
  },
  {
    q: 'Can a creator offer more than one tier?',
    a: 'Absolutely — stack as many monthly tiers as make sense for you, each with its own name, price, and description, so fans can pick whatever level fits them.',
  },
  {
    q: 'Is my payment information safe?',
    a: "Yes, and we mean that literally: every payment and payout runs through Stripe, and ByUs never sees or stores a single card number — not what a fan pays with, not what a creator gets paid out to.",
  },
  {
    q: 'Can creators connect Discord or Telegram?',
    a: "Yep — link a Discord server and/or a private Telegram group in Settings, and ByUs handles the bouncer duty for you: the moment someone subscribes they get the matching Discord role or Telegram access automatically, and it's revoked automatically the second they cancel. Totally optional, and your ByUs page stays the real source of truth either way.",
  },
];
