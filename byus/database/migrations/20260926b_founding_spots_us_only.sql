-- Founding spots are for US creators only (Sept 26, 2026). See lib/creator-countries.js.
-- Cross-border payouts cost ByUs ~1.25% more, so creators outside the US join at standard
-- pricing (13%, dropping to 10% for any month they earn $2,000) and don't take one of the
-- 50 founding spots. NULL country = joined before the country question existed (US).

CREATE OR REPLACE FUNCTION public.reserve_waitlist_founding_spot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.country IS NULL OR NEW.country = 'US' THEN
    PERFORM reserve_founding_spot(NEW.email);
  END IF;
  RETURN NEW;
END;
$function$;
