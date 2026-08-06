CREATE VIEW "cfpb-complaints".vw_fastest_growing_issues AS
WITH
  m AS (
   SELECT
     month_received
   , issue
   , sub_issue
   , COUNT(*) complaints
   FROM
     vw_cfpb_base
   GROUP BY month_received, issue, sub_issue
) 
, g AS (
   SELECT
     month_received
   , issue
   , sub_issue
   , complaints
   , LAG(complaints) OVER (PARTITION BY issue, sub_issue ORDER BY month_received ASC) prev_complaints
   FROM
     m
) 
SELECT
  month_received
, issue
, sub_issue
, complaints
, prev_complaints
, ROUND(((1E2 * (complaints - prev_complaints)) / prev_complaints), 1) mom_growth_pct
, RANK() OVER (PARTITION BY month_received ORDER BY (((complaints - prev_complaints) * 1E0) / prev_complaints) DESC) growth_rank
FROM
  g
WHERE (prev_complaints >= 10)