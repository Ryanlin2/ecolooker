CREATE VIEW "cfpb-complaints".vw_mix_product_monthly AS
WITH
  m AS (
   SELECT
     month_received
   , product
   , sub_product
   , COUNT(*) complaints
   FROM
     vw_cfpb_base
   GROUP BY month_received, product, sub_product
) 
, shares AS (
   SELECT
     month_received
   , product
   , sub_product
   , complaints
   , ROUND(((1E2 * complaints) / SUM(complaints) OVER (PARTITION BY month_received)), 2) share_pct
   FROM
     m
) 
SELECT
  month_received
, product
, sub_product
, complaints
, share_pct
, (share_pct - LAG(share_pct) OVER (PARTITION BY product, sub_product ORDER BY month_received ASC)) share_pct_change_mom
FROM
  shares