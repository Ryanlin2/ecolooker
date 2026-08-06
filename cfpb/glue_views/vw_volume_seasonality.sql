CREATE VIEW "cfpb-complaints".vw_volume_seasonality AS
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
  day_of_week(day_received) dow
, month(day_received) month_of_year
, AVG(complaints) avg_complaints
, COUNT(*) days_observed
FROM
  daily
GROUP BY day_of_week(day_received), month(day_received)