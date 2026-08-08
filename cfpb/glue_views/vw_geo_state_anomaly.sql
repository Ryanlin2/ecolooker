CREATE OR REPLACE VIEW "cfpb-complaints".vw_geo_state_anomaly AS
WITH
  daily AS (
   SELECT
     day_received
   , state
   , COUNT(*) complaints
   FROM
     vw_cfpb_base
   WHERE ((state IS NOT NULL) AND (state <> ''))
   GROUP BY day_received, state
)
, stats AS (
   -- Expected complaints for the day: the state's own trailing 180-day
   -- (~6 month) daily average, excluding the day itself.
   -- expected_complaints = AVG(complaints) over the trailing 180 days
   -- z_score             = (complaints - expected_complaints) / STDDEV(trailing 180 days)
   SELECT
     day_received
   , state
   , complaints
   , AVG(complaints) OVER trail baseline_avg
   , STDDEV_SAMP(complaints) OVER trail baseline_std
   FROM
     daily
   WINDOW trail AS (PARTITION BY state ORDER BY day_received ASC ROWS BETWEEN 180 PRECEDING AND 1 PRECEDING)
)
SELECT
  day_received
, state
, complaints
, ROUND(baseline_avg, 1) expected_complaints
, (CASE WHEN (baseline_std > 0) THEN ROUND(((complaints - baseline_avg) / baseline_std), 2) END) z_score
, ((baseline_std > 0)
    AND (complaints >= 10)
    AND (((complaints - baseline_avg) / baseline_std) >= 3)
  ) is_spike
FROM
  stats
