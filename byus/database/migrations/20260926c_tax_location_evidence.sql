-- Evidence of where each paying fan lives (Sept 26, 2026). See lib/tax-location-evidence.js.
--
-- UK and EU VAT rules require a seller of digital services to consumers to keep two
-- non-contradictory pieces of evidence of the customer's location. ByUs records three on
-- every fan payment: the billing country from Stripe Checkout, the country of the card
-- issuer, and the country of the fan's IP address when they started checkout. The
-- resolved country is the one at least two of them agree on.
--
-- status: 'ok'       -- two or more pieces agree, and they agree with the billing country
--                        Stripe Tax charged for
--         'conflict' -- no two pieces agree, fewer than two pieces exist, or the pieces that
--                        agree point somewhere other than the billing country. Shown on
--                        /admin/tax-evidence so the fan can be asked to confirm (HMRC's
--                        "contact the consumer" step). Never blocks a payment.
--         'resolved' -- a conflict an admin settled, with the confirmed country and a note.
--
-- Retention: keep every row for at least 10 years (EU OSS record-keeping; the UK asks for
-- 6). Rows are never deleted, and deleting a user only clears fan_id/creator_id. The IP
-- address is personal data: it is only read by admin routes and never shown publicly.

CREATE TABLE IF NOT EXISTS tax_location_evidence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_charge_id  text NOT NULL UNIQUE,
  stripe_invoice_id text,
  payment_kind      text NOT NULL,             -- 'subscription' | 'tip' | 'product'
  fan_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  creator_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  amount_cents      integer NOT NULL,
  tax_cents         integer NOT NULL DEFAULT 0,
  billing_country   text,
  card_country      text,
  ip_country        text,
  ip_address        text,
  ip_captured_at    timestamptz,
  resolved_country  text,
  taxed_country     text,
  status            text NOT NULL CHECK (status IN ('ok', 'conflict', 'resolved')),
  conflict_reason   text,
  confirmed_country text,
  resolution_note   text,
  resolved_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at       timestamptz,
  paid_at           timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_location_evidence_conflicts_idx
  ON tax_location_evidence (paid_at) WHERE status = 'conflict';
CREATE INDEX IF NOT EXISTS tax_location_evidence_paid_at_idx
  ON tax_location_evidence (paid_at);
