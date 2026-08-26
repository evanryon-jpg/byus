# ByUs

A creator subscription platform. Fans pay creators monthly; ByUs takes a flat 10% fee via Stripe Connect, the rest goes directly to the creator's own Stripe account.

## Stack
- Next.js 14 (App Router)
- Neon (Postgres) — database already created and schema applied for you
- Stripe Connect (Express accounts, Checkout, webhooks)
- Tailwind CSS

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Environment variables**
   Copy `.env.example` to `.env.local`. The `DATABASE_URL` is already filled in with your real Neon connection string — no changes needed there.

   You still need to fill in:
   - `JWT_SECRET` — any long random string (e.g. run `openssl rand -base64 32`)
   - `STRIPE_SECRET_KEY` — from your Stripe Dashboard, Developers → API keys (use the **test mode** key while developing)
   - `STRIPE_WEBHOOK_SECRET` — you'll get this in step 4 below

3. **Run locally**
   ```
   npm run dev
   ```
   Visit http://localhost:3000

4. **Set up the Stripe webhook (required for subscriptions to actually activate)**
   - Install the Stripe CLI: https://stripe.com/docs/stripe-cli
   - Run: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - Copy the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET` in `.env.local`
   - Restart `npm run dev`

   (For production, add a webhook endpoint in the Stripe Dashboard pointing to `https://yourdomain.com/api/webhooks/stripe`, subscribed to: `account.updated`, `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.)

## Testing the full flow

1. Sign up as a **creator** at `/signup`
2. On the creator dashboard, click **"Connect Stripe & start earning"** — completes Stripe's hosted onboarding (use Stripe's test data)
3. Once connected, create a subscription tier and a post (try one public, one "subscribers only")
4. Sign up as a **fan** in a different browser/incognito window
5. Go to `/browse`, find your creator, click **Subscribe**
6. Use Stripe's test card: `4242 4242 4242 4242`, any future expiry, any CVC
7. After checkout, the subscribers-only post should now be visible on the creator's profile

## Deploying

Recommended: **Vercel** (same company as Next.js, zero-config deploy) — connects directly to this Neon database with no changes needed. Just add the same environment variables in Vercel's project settings.

## What's built vs. what's next
Built: signup/login, Stripe Connect onboarding, tiers, posts, content gating, subscribe + checkout, webhook sync, fan subscription dashboard.

Not yet built (future features, discussed but intentionally out of MVP scope): instant payouts, video embeds, admin panel, profit-sharing fund, fee transparency dashboard.
