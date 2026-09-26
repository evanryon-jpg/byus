-- Switching links (Sept 26, 2026). See lib/switch-links.js.
--
-- A creator bringing fans over from another platform (Patreon, Ko-fi, ...) sends them a
-- private link. A fan who joins through it gets access right away but isn't charged until
-- first_charge_at, the date their already-paid period elsewhere runs out, so nobody pays
-- twice. Nothing is charged until then, so ByUs pays no Stripe fees in the meantime.
--
-- switch_link_redemptions: one row per fan per creator (a fan can use a switching link
-- for a given creator once, ever), written by the Stripe webhook when the checkout
-- completes. uses on switch_links is the running count checked against max_uses.

CREATE TABLE IF NOT EXISTS switch_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code            text NOT NULL UNIQUE,
  label           text NOT NULL,
  first_charge_at timestamptz NOT NULL,
  max_uses        integer NOT NULL CHECK (max_uses BETWEEN 1 AND 5000),
  uses            integer NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS switch_links_creator_idx ON switch_links (creator_id);

CREATE TABLE IF NOT EXISTS switch_link_redemptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id                uuid NOT NULL REFERENCES switch_links(id) ON DELETE CASCADE,
  creator_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, fan_id)
);
