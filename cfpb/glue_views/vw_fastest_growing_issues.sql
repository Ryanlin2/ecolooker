CREATE VIEW "cfpb-complaints".vw_fastest_growing_issues AS
WITH
  months AS (
   SELECT DISTINCT month_received
   FROM
     vw_cfpb_base
)
, pairs AS (
   SELECT DISTINCT
     issue
   , sub_issue
   FROM
     vw_cfpb_base
)
, grid AS (
   SELECT
     months.month_received
   , pairs.issue
   , pairs.sub_issue
   FROM
     months
   CROSS JOIN pairs
)
, m AS (
   SELECT
     month_received
   , issue
   , sub_issue
   , COUNT(*) complaints
   FROM
     vw_cfpb_base
   GROUP BY month_received, issue, sub_issue
)
, filled AS (
   SELECT
     grid.month_received
   , grid.issue
   , grid.sub_issue
   , COALESCE(m.complaints, 0) complaints
   FROM
     grid
   LEFT JOIN m ON (grid.month_received = m.month_received)
      AND (grid.issue = m.issue)
      AND (grid.sub_issue = m.sub_issue)
)
, g AS (
   SELECT
     month_received
   , issue
   , sub_issue
   , complaints
   , COALESCE(LAG(complaints) OVER (PARTITION BY issue, sub_issue ORDER BY month_received ASC), 0) prev_complaints
   FROM
     filled
)
SELECT
  month_received
, issue
, sub_issue
, complaints
, prev_complaints
, ROUND(((1E2 * (complaints - prev_complaints)) / NULLIF(prev_complaints, 0)), 1) mom_growth_pct
, RANK() OVER (PARTITION BY month_received ORDER BY (((complaints - prev_complaints) * 1E0) / NULLIF(prev_complaints, 0)) DESC) growth_rank
FROM
  g
WHERE (prev_complaints >= 10)