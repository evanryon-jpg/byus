-- Run only on an isolated test branch after the migration. Always rolls back test data.
BEGIN;
DO $$
DECLARE
  spot integer; repeated integer; original_count integer; user_id uuid;
  fee integer; n integer; test_email text := 'founding-test-' || gen_random_uuid() || '@example.invalid';
BEGIN
  SELECT count(*) INTO original_count FROM founding_reservations;
  ASSERT original_count < 99, 'Use a fixture with at least two available spots';
  INSERT INTO founding_waitlist (email) VALUES (test_email);
  SELECT spot_number INTO spot FROM founding_reservations WHERE email = test_email;
  ASSERT spot = original_count + 1, 'Waitlist must immediately reserve the next spot';
  repeated := reserve_founding_spot('  ' || upper(test_email) || '  ');
  ASSERT repeated = spot, 'Email normalization must not allocate another spot';
  INSERT INTO founding_waitlist (email) VALUES (test_email) ON CONFLICT (email) DO NOTHING;
  ASSERT (SELECT count(*) FROM founding_reservations) = original_count + 1, 'Duplicate entry consumed a spot';

  -- Exhaust the remaining pool, then sign up the reserved creator out of order.
  FOR n IN 1..100 LOOP
    PERFORM reserve_founding_spot('capacity-' || n || '-' || test_email);
  END LOOP;
  ASSERT (SELECT count(*) FROM founding_reservations) = 100, 'Pool must stop at 100';
  ASSERT reserve_founding_spot('overflow-' || test_email) IS NULL, 'Sold-out pool allocated a spot';
  INSERT INTO users (email, role, platform_fee_percent)
  VALUES (test_email, 'creator', 13) RETURNING id, platform_fee_percent INTO user_id, fee;
  ASSERT fee = 10, 'Reserved creator must get 10% even after all spots are taken';
  ASSERT (SELECT spot_number FROM founding_reservations WHERE creator_id = user_id) = spot, 'Signup lost reserved number';
  UPDATE users SET email = 'changed-' || test_email WHERE id = user_id;
  ASSERT (SELECT spot_number FROM founding_reservations WHERE creator_id = user_id) = spot, 'Email change lost founding status';

  INSERT INTO users (email, role, platform_fee_percent)
  VALUES ('overflow-' || test_email, 'creator', 10) RETURNING platform_fee_percent INTO fee;
  ASSERT fee = 13, 'Unreserved creator must get standard pricing after sellout';
  INSERT INTO founding_waitlist (email) VALUES ('overflow-waitlist-' || test_email);
  ASSERT NOT EXISTS (SELECT 1 FROM founding_reservations WHERE email = 'overflow-waitlist-' || test_email), 'General waitlist must not oversubscribe';
  INSERT INTO users (email, role) VALUES ('fan-' || test_email, 'fan');
  ASSERT (SELECT count(*) FROM founding_reservations) = 100, 'Fan signup changed reservation count';
  SET CONSTRAINTS ALL IMMEDIATE;
END;
$$;
ROLLBACK;
