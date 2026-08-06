CREATE VIEW "cfpb-complaints".vw_cfpb_base AS
SELECT
  complaint_id
, (complaint_id IS NULL) missing_complaint_id
, date_received
, date_sent_to_company
, CAST(date_trunc('day', date_received) AS date) day_received
, CAST(date_trunc('week', date_received) AS date) week_received
, CAST(date_trunc('month', date_received) AS date) month_received
, COALESCE(NULLIF(trim(BOTH FROM product), ''), 'UNKNOWN') product
, COALESCE(NULLIF(trim(BOTH FROM sub_product), ''), 'UNKNOWN') sub_product
, COALESCE(NULLIF(trim(BOTH FROM issue), ''), 'UNKNOWN') issue
, COALESCE(NULLIF(trim(BOTH FROM sub_issue), ''), 'UNKNOWN') sub_issue
, consumer_complaint_narrative narrative
, company_public_response
, company
, upper(trim(BOTH FROM state)) state
, zip_code
, (CASE WHEN regexp_like(trim(BOTH FROM zip_code), '^[0-9]{3}') THEN substr(trim(BOTH FROM zip_code), 1, 3) ELSE null END) zip3
, tags
, submitted_via
, company_response_to_consumer company_response
, timely_response
, timely_response_flag
, date_diff('day', date_received, date_sent_to_company) routing_lag_days
, COALESCE(has_narrative, ((consumer_complaint_narrative IS NOT NULL) AND (trim(BOTH FROM consumer_complaint_narrative) <> ''))) has_narrative
, COALESCE((company_response_to_consumer = 'Closed with monetary relief'), false) is_monetary_relief
, COALESCE((company_response_to_consumer = 'Closed with non-monetary relief'), false) is_nonmonetary_relief
, COALESCE((company_response_to_consumer = 'In progress'), false) is_in_progress
, COALESCE((tags LIKE '%Servicemember%'), false) is_servicemember
, COALESCE((tags LIKE '%Older American%'), false) is_older_american
, record_hash
FROM
  "cfpb-complaints".complaints
ORDER BY date_received ASC
