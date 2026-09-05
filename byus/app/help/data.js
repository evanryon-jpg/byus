// Content for the Help Center (app/help/page.js and app/help/[category]/page.js).
//
// This is a plain data module, not a database table — help content changes by editing
// code and pushing, same as the rest of the marketing copy on this site. That's the right
// tradeoff for a young, one-person-run platform: no admin UI to build or secure, and every
// answer here is checked against the actual product (see the fee numbers, payout wording,
// and cancellation policy — deliberately kept word-for-word consistent with
// app/components/FAQSection.jsx on the homepage, so a fan never gets two different answers
// to the same question depending on which page they land on).
//
// Structure mirrors what a help center needs to actually help: a handful of topic
// categories a visitor can browse, each holding a short list of real Q&A entries, plus a
// flat, searchable index of everything for the search box on app/help/page.js.

export const HELP_CATEGORIES = [
  {
    slug: 'getting-started-creators',
    icon: '🚀',
    title: 'Getting started as a creator',
    description: 'Claim your page, connect Stripe, and set up tiers.',
    articles: [
      {
        q: 'How do I set up my ByUs page?',
        a: 'Sign up as a creator, then head to your dashboard. From there you can claim a short page URL, add a bio and profile photo, connect Stripe so you can get paid, and create your first subscription tier or publish a post — you don’t have to do these in order, and your page works as soon as any one of them is live.',
      },
      {
        q: "What's the AI setup assistant?",
        a: 'On your dashboard, describe what you make or post about in a sentence or two and it suggests a starter bio, categories, and a few tier ideas with names and prices already filled in. Everything it suggests is a starting point you can edit or ignore — nothing is saved until you choose to use it.',
      },
      {
        q: 'How do I connect Stripe so I can get paid?',
        a: 'Your dashboard has a "Connect Stripe" step under "Get set up to earn." It walks you through creating a free Stripe Express account (or linking an existing one) in Stripe’s own onboarding flow. Once it’s done, tips and subscriptions pay out to that account directly — ByUs never holds your money.',
      },
      {
        q: 'What are subscription tiers, and how many should I create?',
        a: 'A tier is a recurring monthly (or annual) price with its own name, description, and perks — think "Supporter," "Fan club," "VIP." Most creators start with one to three tiers. You can create tiers before connecting Stripe; they save as drafts and go live automatically once Stripe is connected.',
      },
      {
        q: 'Do I need tiers to accept tips?',
        a: "No. One-time tips work independently of subscription tiers — as soon as Stripe is connected, both your profile page and your standalone tip link can accept them, tiers or not.",
      },
      {
        q: 'How do I claim a custom page URL?',
        a: 'In the "Your page URL" card on your dashboard, click Change and enter a short, lowercase handle (letters, numbers, and hyphens only, 3–30 characters). Your existing link keeps working if you’ve already shared it — visitors are just quietly redirected to the new one.',
      },
    ],
  },
  {
    slug: 'getting-started-fans',
    icon: '👋',
    title: 'Getting started as a fan',
    description: 'What ByUs is, and how to support a creator.',
    articles: [
      {
        q: 'What is ByUs?',
        a: 'ByUs is a place for creators to earn direct support from their audience — through paid monthly (or annual) memberships, one-time tips, or both. In exchange, creators post updates, photos, and members-only content straight to their ByUs page.',
      },
      {
        q: 'How do I support a creator?',
        a: "Visit their ByUs page and either subscribe to one of their tiers for ongoing access, or send a one-time tip if they've connected payments. You'll need an account for either — signing up takes an email and a password (or Google/Apple sign-in).",
      },
      {
        q: 'Do I need an account to send a one-time tip?',
        a: "Yes, a ByUs account is required, and your email needs to be verified before your first payment goes through. It's the same account you'd use to subscribe, so it's one signup either way.",
      },
      {
        q: "What's the difference between a subscription and a tip?",
        a: "A subscription is a recurring monthly or annual payment that unlocks that creator's members-only posts for as long as it's active. A tip is a single one-time payment — no recurring charge, no members-only access unlocked, just a direct thank-you.",
      },
      {
        q: 'Can I support more than one creator?',
        a: 'Yes — there’s no limit. Every subscription and tip you’ve sent is tracked separately in your fan dashboard.',
      },
    ],
  },
  {
    slug: 'payments-fees',
    icon: '💳',
    title: 'Payments & fees',
    description: 'What ByUs takes, and how creators get paid.',
    articles: [
      {
        q: 'How much does ByUs take from a creator’s earnings?',
        a: "ByUs's fee starts at 10% and drops to 7% for any calendar month a creator's earnings on ByUs reach $2,000 gross — moving back to 10% the next month if that threshold isn't met again. There's no separate fee for tips versus subscriptions, and no extra charge for currency conversion or payouts stacked on top.",
      },
      {
        q: 'When do creators get paid?',
        a: "Directly and on Stripe's own schedule. Every creator connects their own Stripe Express account once, and both tips and subscription payments go straight there — there's no separate ByUs payout process, holding period, or minimum balance to reach first. The exact payout timing for your account is visible in your own Stripe dashboard.",
      },
      {
        q: 'What payment methods can fans use?',
        a: 'Whatever Stripe Checkout supports for your currency — in practice, major debit and credit cards, and often digital wallets like Apple Pay or Google Pay if your browser or device supports them.',
      },
      {
        q: 'Does it cost anything to become a creator?',
        a: "No. Creating a page, adding tiers, and posting are all free, with no listing or setup fee. ByUs only makes money through its platform fee, and only once a creator actually gets paid.",
      },
      {
        q: 'Is my payment information safe?',
        a: 'All payments and payouts run through Stripe. ByUs never sees or stores full card numbers — that’s true for what a fan pays and for what a creator gets paid out.',
      },
    ],
  },
  {
    slug: 'managing-subscription',
    icon: '🔄',
    title: 'Managing your subscription',
    description: 'Cancel, change tiers, or update your card.',
    articles: [
      {
        q: 'How do I cancel my subscription?',
        a: 'From your fan dashboard, open the creator’s subscription and choose Cancel — this uses Stripe’s secure billing portal, so you never re-enter card details. Every subscription is month-to-month with no contract, and cancelling takes effect at the end of the period you’ve already paid for, not immediately.',
      },
      {
        q: 'What happens to my access if I cancel?',
        a: "You keep access to that creator's members-only posts through the end of your current billing period. Anything they've posted publicly stays visible either way, cancelled or not.",
      },
      {
        q: 'How do I update my card or see past invoices?',
        a: "Your fan dashboard links out to Stripe's billing portal, where you can update your payment method, download receipts, and see your full billing history for every creator you support — without emailing anyone.",
      },
      {
        q: "What happens if a payment fails?",
        a: "Stripe automatically retries a failed card a few times over the following days. If it keeps failing, that subscription moves to a past-due state and eventually cancels — updating your card in the billing portal before then keeps it active without any gap.",
      },
      {
        q: 'Can I switch to a different tier?',
        a: 'Yes — visit the creator’s page and subscribe to the new tier; your dashboard and the billing portal reflect the change from your next billing cycle.',
      },
    ],
  },
  {
    slug: 'posts-content',
    icon: '📝',
    title: 'Posts & content',
    description: 'Publishing updates, photos, and polls.',
    articles: [
      {
        q: 'How do I publish a post?',
        a: 'From the Posts card on your dashboard, write a title (optional) and body, add a photo if you want one, choose Public or Subscribers only, and click Post. It appears on your page immediately.',
      },
      {
        q: "What's the difference between a public and a members-only post?",
        a: 'A public post is visible to anyone who visits your page, subscriber or not — it’s what a prospective fan sees before deciding to join. A members-only post only shows its title and date to non-subscribers; the body, photo, and poll stay hidden until someone subscribes.',
      },
      {
        q: 'Can I add a poll to a post?',
        a: 'Yes — check "Add a poll" while writing a post and your post text becomes the question fans vote on. Results show as a percentage bar once someone has voted, with their own choice highlighted.',
      },
      {
        q: 'Can I add photos to a post?',
        a: 'Yes, one photo per post via the Image field when you’re writing it. A members-only post’s photo is served privately — it’s never sent to a visitor’s browser unless they’re actually subscribed.',
      },
      {
        q: 'How do fans search or filter my posts?',
        a: 'Once a page has more than a few posts, a search box and filter chips appear above the feed — fans can filter by type (updates, photos, polls) or by public vs. members-only, or search by keyword.',
      },
    ],
  },
  {
    slug: 'live-streaming',
    icon: '📺',
    title: 'Live streaming',
    description: 'Go live, right on your ByUs page.',
    articles: [
      {
        q: 'Does ByUs support live streaming?',
        a: 'Yes. Creators can stream directly to their ByUs page using standard streaming software pointed at the RTMP details in their dashboard’s Live streaming card.',
      },
      {
        q: 'Who can watch my stream?',
        a: 'That follows the same public/members-only choice as posts — you decide whether anyone visiting your page can watch, or only active subscribers.',
      },
      {
        q: 'What software do I need to go live?',
        a: 'Any standard RTMP-capable broadcaster (OBS Studio is a common free choice) — plug the stream key and server URL from your dashboard into it and go live from there. Your ByUs page shows a "LIVE" badge and the player automatically the moment your stream starts.',
      },
    ],
  },
  {
    slug: 'tips-messages',
    icon: '☕',
    title: 'Tips & messages',
    description: 'One-time support, with an optional note.',
    articles: [
      {
        q: 'How do one-time tips work?',
        a: "A fan picks a preset amount or enters a custom one (from $1 up to $500) and pays through Stripe Checkout — no subscription created, no recurring charge, just a single payment straight to the creator's connected account.",
      },
      {
        q: 'Can a fan leave a message with a tip?',
        a: 'Yes — there’s an optional "Add a message" field on every tip flow. It’s private: only the creator sees it, regardless of whether that fan shows up publicly as a supporter elsewhere on the page.',
      },
      {
        q: 'Where do I see the tips and messages I’ve received?',
        a: 'Your dashboard has a "Recent tips" section listing your most recent one-time tips with amount, sender (if they’ve opted into public support), and any message they left.',
      },
      {
        q: 'Is there a link I can share just for tips?',
        a: 'Yes — every creator gets a standalone tip page at their page URL plus "/tip" (for example, byusapp.com/creator/yourname/tip). It’s a stripped-down page with just the coffee-buying flow, meant for dropping into a video description or stream panel. Copy it from the "Copy tip link" button on your dashboard.',
      },
    ],
  },
  {
    slug: 'growing-your-audience',
    icon: '📈',
    title: 'Growing your audience',
    description: 'Referrals, goals, and welcome messages.',
    articles: [
      {
        q: "What's the referral program?",
        a: 'Every account has a referral link (find it under Settings → Refer a friend). When someone signs up through it and becomes a paying subscriber, both sides get a free month — it’s a two-way reward, not just a discount for the person you referred.',
      },
      {
        q: 'How does the monthly support goal work?',
        a: 'From your dashboard, set an optional monthly earnings goal and a progress bar appears on your public page tracking both subscriptions and tips toward it. It resets automatically at the start of each calendar month.',
      },
      {
        q: 'Can I set a welcome message for new subscribers?',
        a: 'Yes — each tier can have its own welcome message, shown to a fan right after they subscribe to it. Use it to point new subscribers toward your best content or say thanks in your own voice.',
      },
      {
        q: 'Should I offer annual pricing?',
        a: 'It’s optional per tier — if you set an annual price alongside the monthly one, fans see a Monthly/Annually toggle on your page and typically save a bit for committing for the year. Leave it blank on any tier where you’d rather keep things month-to-month only.',
      },
      {
        q: 'How do I add my social links?',
        a: 'The Links card on your dashboard has quick-add buttons for nine platforms (Instagram, TikTok, YouTube, X, Twitch, Facebook, Discord, Medium, and GitHub) that prefill the URL format for you — just drop in your username.',
      },
    ],
  },
  {
    slug: 'account-privacy-trust',
    icon: '🔐',
    title: 'Account, privacy & trust',
    description: 'Passwords, visibility, and policies.',
    articles: [
      {
        q: 'How do I reset my password?',
        a: 'Use the "Forgot password" link on the login page — it emails you a reset link. If you’re already signed in, you can change your password directly from Settings instead.',
      },
      {
        q: "How do I control whether I show up as a public supporter?",
        a: 'Settings → Support visibility has a toggle for this. It’s off by default, meaning you support creators privately; turning it on lets a creator’s "Top supporters" list show your name and photo. It never affects whether a private tip message is seen — that always goes to the creator alone.',
      },
      {
        q: 'How do I turn email notifications on or off?',
        a: 'Settings → Notifications lists what ByUs emails you about (new posts from creators you support, subscriber updates if you’re a creator, and account/billing notices) with a toggle for each.',
      },
      {
        q: 'How do I report a problem or abusive content?',
        a: 'Email evanryon@yahoo.com with a link to the page or post and a short description — reports are handled directly rather than through an automated system, given ByUs’s size today.',
      },
      {
        q: 'Where can I read the Terms of Service and Privacy Policy?',
        a: 'Both are linked in the footer of every page — Terms of Service and Privacy Policy — and cover how accounts, payments, and your data are handled in full.',
      },
    ],
  },
];

// Flat, searchable index over every article — built once from the structure above so it
// can never drift out of sync with it. Each entry carries its parent category's slug/title
// so a search result can both display context and link straight to the right place.
export const ALL_HELP_ARTICLES = HELP_CATEGORIES.flatMap((category) =>
  category.articles.map((article) => ({
    ...article,
    categorySlug: category.slug,
    categoryTitle: category.title,
  }))
);

export function getCategoryBySlug(slug) {
  return HELP_CATEGORIES.find((c) => c.slug === slug) || null;
}
