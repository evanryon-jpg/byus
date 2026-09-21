-- Shrink the Founding Creator Program from 100 to 50 spots.
-- Safe while reservations are <= 50; existing spot numbers are unchanged.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('byus_founding_creator_signup'));
DO $$ BEGIN
  IF (SELECT coalesce(max(spot_number), 0) FROM founding_reservations) > 50 THEN
    RAISE EXCEPTION 'More than 50 founding spots already reserved';
  END IF;
END $$;
ALTER TABLE founding_reservations DROP CONSTRAINT founding_reservations_spot_number_check;
ALTER TABLE founding_reservations ADD CONSTRAINT founding_reservations_spot_number_check
  CHECK (spot_number BETWEEN 1 AND 50);

CREATE OR REPLACE FUNCTION reserve_founding_spot(reservation_email text) RETURNS integer
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
  IF spot > 50 THEN RETURN NULL; END IF;
  INSERT INTO founding_reservations (email, spot_number) VALUES (normalized_email, spot);
  RETURN spot;
END;
$$;
COMMIT;
