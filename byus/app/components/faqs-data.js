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
    a: "Founding spots are open now, and creator accounts open soon. Founding spots are for creators in the US. Reserving one is free and locks in the 10% rate for good; your confirmation shows your spot number. Creator accounts open in the US first, with the UK, Europe and Canada next; creators there can join the list now and will start at standard pricing. When accounts open, we'll email you a link, and you create your creator account with the same email to claim it. If all 50 spots are reserved, you can still join for updates at standard pricing. Fans, you're all set: sign up and subscribe as normal in the meantime. Creating a ByUs account is free either way; Stripe separately reviews every connected account and may ask for verification info before it'll turn on payments or payouts.",
  },
  {
    q: 'How does the platform fee work?',
    a: "ByUs's standard all-in platform fee starts at 13% of each payment. When a non-founding creator reaches $2,000 in gross ByUs earnings during a calendar month, the rate drops to 10% for the rest of that month and resets to 13% at the start of the next month until the threshold is reached again. The 50 founding spots, for US creators, carry a 10% rate for good, with no earnings requirement. That rate is genuinely all-in: it covers standard domestic and cross-border processing, and ByUs absorbs Stripe's extra charges for international cards and currency conversion, so a fan paying from outside the US doesn't cost you anything extra — the rest is paid straight into your connected Stripe account. Instant payouts, taxes, disputes, or other unusual processor costs may still apply separately, and we'll spell those out when they do.",
  },
  {
    q: 'When and how do creators get paid?',
    a: "Straight to you, no detours. Connect your own Stripe Express account once. Your share of every payment lands in your Stripe balance the moment a fan pays, and Stripe sends it to your bank every Monday. ByUs never holds your money, and there's no minimum to hit first. Stripe holds a brand-new account's very first payout for about 7 to 14 days while it verifies you; after that it's every week.",
  },
  {
    q: 'Is it easy for a fan to cancel?',
    a: "Painfully easy, honestly — in a good way. Every subscription is month-to-month, no contracts hiding anywhere. Cancel anytime from your dashboard and you'll keep access through the end of the period you already paid for. No penalty, no guilt-trip phone call required.",
  },
  {
    q: 'What happens to my access if I cancel?',
    a: "You keep subscriber-only posts and connected Discord or Telegram access through the end of the billing period you already paid for. When that period ends, member-only access is removed automatically. Public posts remain available either way.",
  },
  {
    q: 'Does it cost anything to become a creator?',
    a: "Nope — setting up your page costs nothing, with zero listing fees and zero setup fees. We only make money when you do. The standard all-in fee starts at 13% and drops to 10% for the rest of a calendar month after $2,000 in gross ByUs earnings, while US creators with a reserved founding spot lock in 10% forever.",
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
    q: 'Can I take my content with me if I leave?',
    a: "Your work stays yours. From your dashboard you can download every video you've uploaded as an MP4, and export your full earnings history as a spreadsheet at any time. Your payouts go straight to your own Stripe account, so your payment records live there too. We're working on exports for written posts and your member list next.",
  },
  {
    q: 'Can creators connect Discord or Telegram?',
    a: "Yep — link a Discord server and/or a private Telegram group in Settings, and ByUs handles the bouncer duty for you: the moment someone subscribes they get the matching Discord role or Telegram access automatically. If they cancel, that access remains through their paid billing period and is removed automatically when the subscription ends. Totally optional, and your ByUs page stays the real source of truth either way.",
  },
];
