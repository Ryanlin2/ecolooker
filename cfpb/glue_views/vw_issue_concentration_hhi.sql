CREATE VIEW "cfpb-complaints".vw_issue_concentration_hhi AS
WITH
  shares AS (
   SELECT
     month_received
   , product
   , issue
   , ((1E2 * COUNT(*)) / SUM(COUNT(*)) OVER (PARTITION BY month_received, product)) share_pct
   FROM
     vw_cfpb_base
   GROUP BY month_received, product, issue
) 
SELECT
  month_received
, product
, ROUND(SUM((share_pct * share_pct)), 0) hhi
FROM
  shares
GROUP BY month_received, product