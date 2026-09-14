-- Anonymous aggregate counters for ByUs-owned campaign pages.
-- No IP address, browser identifier, email, or visitor history is stored.
CREATE TABLE IF NOT EXISTS campaign_metrics (
  day date NOT NULL DEFAULT CURRENT_DATE,
  campaign text NOT NULL,
  event text NOT NULL,
  event_count bigint NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  PRIMARY KEY (day, campaign, event)
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_day
  ON campaign_metrics (campaign, day DESC);
