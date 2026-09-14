-- Founding Creator waitlist: captures interest from would-be creators while Stripe
-- Connect onboarding is paused for platform review, instead of walking them through a
-- signup flow that would dead-end at the "Connect Stripe" step. See app/waitlist/page.js
-- and app/api/waitlist/route.js. Deliberately NOT a users row -- no password, no role,
-- nothing that implies an account exists -- this is a marketing lead list to invite from
-- the moment Stripe clears review, not a partial account.
CREATE TABLE founding_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  -- Which CTA sent them here (hero, the Founding Creator Program section, etc.) -- purely
  -- for the site owner to see which placement actually converts, never shown to visitors.
  source text,
  referral_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_founding_waitlist_created_at ON founding_waitlist (created_at DESC);
