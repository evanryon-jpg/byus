-- Where each founding-spot reservation lives (Sept 26, 2026). See lib/creator-countries.js.
--
-- country: ISO code chosen on the founding-spot form ('US', 'GB', 'DE', ...), or 'OTHER'
--   for a country ByUs can't pay creators in. NULL = joined before this column existed
--   (treated as US).
--
-- Creator accounts are US-only at launch. UK / EEA / Canada / Switzerland entries still
-- reserve a founding spot (they're emailed when their country opens). 'OTHER' entries join
-- the list but don't take one of the 50 spots, since there's no date we could honor it by.

ALTER TABLE founding_waitlist ADD COLUMN IF NOT EXISTS country text;

CREATE OR REPLACE FUNCTION public.reserve_waitlist_founding_spot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.country IS DISTINCT FROM 'OTHER' THEN
    PERFORM reserve_founding_spot(NEW.email);
  END IF;
  RETURN NEW;
END;
$function$;
