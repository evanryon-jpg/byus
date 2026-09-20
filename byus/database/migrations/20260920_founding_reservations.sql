-- Apply before deploying reservation-aware application code.
-- One permanent pool shared by existing creators, waitlist entries and future signups.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('byus_founding_creator_signup'));
LOCK TABLE users, founding_waitlist IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE founding_reservations (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email <> ''),
  spot_number integer NOT NULL UNIQUE CHECK (spot_number BETWEEN 1 AND 100),
  creator_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  reserved_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve existing founding creators and their published numbers first.
INSERT INTO founding_reservations (email, spot_number, creator_id, reserved_at)
SELECT lower(btrim(email)), rank::integer, id, created_at
FROM (
  SELECT id, email, created_at, row_number() OVER (ORDER BY created_at, id) AS rank
  FROM users WHERE role = 'creator'
) existing WHERE rank <= 100;

CREATE FUNCTION reserve_founding_spot(reservation_email text) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE normalized_email text := lower(btrim(reservation_email)); spot integer;
BEGIN
  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Reservation email is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('byus_founding_creator_signup'));
  SELECT spot_number INTO spot FROM founding_reservations WHERE email = normalized_email;
  IF spot IS NOT NULL THEN RETURN spot; END IF;
  -- Never recycle numbers: reservations remain even if a creator account is removed.
  SELECT coalesce(max(spot_number), 0) + 1 INTO spot FROM founding_reservations;
  IF spot > 100 THEN RETURN NULL; END IF;
  INSERT INTO founding_reservations (email, spot_number) VALUES (normalized_email, spot);
  RETURN spot;
END;
$$;

-- Honor people already on the waitlist, in their original join order.
DO $$
DECLARE entry record;
BEGIN
  FOR entry IN SELECT email FROM founding_waitlist ORDER BY created_at, id LOOP
    PERFORM reserve_founding_spot(entry.email);
  END LOOP;
END;
$$;

-- Covers old and new waitlist handlers during the deploy transition.
CREATE FUNCTION reserve_waitlist_founding_spot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM reserve_founding_spot(NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER reserve_waitlist_founding_spot
AFTER INSERT ON founding_waitlist
FOR EACH ROW EXECUTE FUNCTION reserve_waitlist_founding_spot();

-- All account creation paths (email, Google, Apple) use the same reservation pool.
CREATE FUNCTION claim_creator_founding_spot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE spot integer; owner_id uuid;
BEGIN
  IF NEW.role <> 'creator' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('byus_founding_creator_signup'));
  SELECT spot_number INTO spot FROM founding_reservations WHERE creator_id = NEW.id;
  IF spot IS NULL THEN
    spot := reserve_founding_spot(NEW.email);
    IF spot IS NOT NULL THEN
      SELECT creator_id INTO owner_id FROM founding_reservations WHERE spot_number = spot;
      IF owner_id IS NOT NULL AND owner_id <> NEW.id THEN
        RAISE EXCEPTION 'Founding reservation is already claimed';
      END IF;
      UPDATE founding_reservations SET creator_id = NEW.id WHERE spot_number = spot;
    END IF;
  END IF;
  -- Preserve an active referral promotion. Normal fees follow the reservation, not revenue.
  NEW.platform_fee_percent := CASE
    WHEN NEW.zero_fee_promo_expires_at > now() THEN 0
    WHEN spot IS NOT NULL THEN 10 ELSE 13 END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER claim_creator_founding_spot
BEFORE INSERT OR UPDATE OF role, email ON users
FOR EACH ROW EXECUTE FUNCTION claim_creator_founding_spot();
COMMIT;
