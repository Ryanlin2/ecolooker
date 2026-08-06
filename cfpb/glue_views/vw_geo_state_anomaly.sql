CREATE VIEW "cfpb-complaints".vw_geo_state_anomaly AS
WITH
  m AS (
   SELECT
     month_received
   , state
   , COUNT(*) complaints
   FROM
     vw_cfpb_base
   WHERE ((state IS NOT NULL) AND (state <> ''))
   GROUP BY month_received, state
) 
, stats AS (
   SELECT
     month_received
   , state
   , complaints
   , AVG(complaints) OVER trail baseline_avg
   , STDDEV_POP(complaints) OVER trail baseline_std
   FROM
     m
   WINDOW trail AS (PARTITION BY state ORDER BY month_received ASC ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING)
) 
SELECT
  month_received
, state
, complaints
, ROUND(baseline_avg, 1) baseline_avg
, (CASE WHEN (baseline_std > 0) THEN ROUND(((complaints - baseline_avg) / baseline_std), 2) END) z_score
, ((baseline_std > 0) AND (((complaints - baseline_avg) / baseline_std) >= 3)) is_spike
FROM
  stats