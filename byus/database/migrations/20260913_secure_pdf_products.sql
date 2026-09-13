-- Secure downloadable PDF products and verified purchase entitlements.
-- Applied to the production Neon database on 2026-09-13.

CREATE TABLE digital_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price_cents integer,
  access_type text NOT NULL DEFAULT 'purchase'
    CHECK (access_type IN ('purchase', 'subscribers_only')),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (access_type = 'purchase' AND price_cents BETWEEN 100 AND 500000)
    OR
    (access_type = 'subscribers_only' AND price_cents IS NULL)
  )
);

CREATE INDEX idx_digital_products_creator_active
  ON digital_products (creator_id, active, created_at DESC);

CREATE TABLE digital_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES digital_products(id),
  fan_id uuid NOT NULL REFERENCES users(id),
  creator_id uuid NOT NULL REFERENCES users(id),
  gross_amount_cents integer NOT NULL CHECK (gross_amount_cents > 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  creator_net_cents integer NOT NULL CHECK (creator_net_cents >= 0),
  stripe_payment_intent_id text NOT NULL UNIQUE,
  stripe_charge_id text,
  status text NOT NULL DEFAULT 'succeeded'
    CHECK (status IN ('succeeded', 'refunded', 'disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, fan_id)
);

CREATE INDEX idx_digital_purchases_fan
  ON digital_purchases (fan_id, created_at DESC);

CREATE INDEX idx_digital_purchases_creator
  ON digital_purchases (creator_id, created_at DESC);
