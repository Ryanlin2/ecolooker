CREATE VIEW "cfpb-complaints".vw_volume_daily AS
WITH
  daily AS (
   SELECT
     day_received
   , COUNT(*) complaints
   FROM
     vw_cfpb_base
   GROUP BY day_received
) 
SELECT
  day_received
, complaints
, AVG(complaints) OVER w7 avg_7d
, AVG(complaints) OVER w30 avg_30d
, (complaints - LAG(complaints, 1) OVER (ORDER BY day_received ASC)) dod_change
, (complaints - LAG(complaints, 7) OVER (ORDER BY day_received ASC)) wow_change
, (CASE WHEN (LAG(complaints, 7) OVER (ORDER BY day_received ASC) > 0) THEN ROUND(((1E2 * (complaints - LAG(complaints, 7) OVER (ORDER BY day_received ASC))) / LAG(complaints, 7) OVER (ORDER BY day_received ASC)), 1) END) wow_pct_change
FROM
  daily
WINDOW
   w7 AS (ORDER BY day_received ASC ROWS BETWEEN 6 PRECEDING AND CURRENT ROW),
   w30 AS (ORDER BY day_received ASC ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)