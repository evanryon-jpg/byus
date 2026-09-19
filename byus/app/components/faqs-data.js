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
    a: "Almost — new creator signups are paused for a moment while we finish tightening up some account setup on our end. Join the waitlist and we'll email you the second it reopens. Fans, you're all set: sign up and subscribe as normal in the meantime. Creating a ByUs account is free either way; Stripe separately reviews every connected account and may ask for verification info before it'll turn on payments or payouts.",
  },
  {
    q: 'How does the platform fee work?',
    a: "Here's the honest version: everyone starts each calendar month at a 13% fee. Cross $2,000 in ByUs earnings that same month and it automatically drops to 10% for the rest of it — no forms, no asking. New month, clean slate: you're back to 13% until you hit $2,000 again, so a slower month just means the standard rate, not a penalty. Bottom line, you keep 87% normally (90% once you've hit the discount) of each standard domestic payment, paid straight into your own Stripe account. Standard domestic processing is baked into that fee; things like currency conversion, instant payouts, taxes, disputes, or unusual processor costs are billed separately and we'll always spell those out when they apply.",
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
    a: "Nope — setting up your page costs nothing, zero listing fees, zero setup fees. We only make money when you do: the all-in fee is 13%, dropping to 10% for any month with at least $2,000 in ByUs earnings and returning to 13% the following month if it doesn't happen again. Join as one of the first 100 founding creators, though, and you lock in 10% forever — no threshold required.",
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
