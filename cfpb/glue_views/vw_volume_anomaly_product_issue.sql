CREATE VIEW "cfpb-complaints".vw_volume_anomaly_product_issue AS
WITH
  daily AS (
   SELECT
     day_received
   , product
   , issue
   , COUNT(*) complaints
   FROM
     vw_cfpb_base
   GROUP BY day_received, product, issue
) 
, stats AS (
   SELECT
     day_received
   , product
   , issue
   , complaints
   , AVG(complaints) OVER trail baseline_avg
   , STDDEV_POP(complaints) OVER trail baseline_std
   FROM
     daily
   WINDOW trail AS (PARTITION BY product, issue ORDER BY day_received ASC ROWS BETWEEN 28 PRECEDING AND 1 PRECEDING)
) 
SELECT
  day_received
, product
, issue
, complaints
, ROUND(baseline_avg, 2) baseline_avg
, (CASE WHEN (baseline_std > 0) THEN ROUND(((complaints - baseline_avg) / baseline_std), 2) END) z_score
, ((baseline_std > 0) AND ((ABS((complaints - baseline_avg)) / baseline_std) >= 3)) is_anomaly
FROM
  stats