-- ============================================================================
-- CFPB COMPLAINT MONITORING — ATHENA VIEW LIBRARY
-- ============================================================================
-- Engine    : Amazon Athena (Trino/Presto SQL)
-- Base table: cfpb_db.complaints   <-- REPLACE with your database.table
-- Convention: all views are built on vw_cfpb_base (View 00), which renames
--             the raw columns (which contain spaces) to snake_case and adds
--             a few derived columns used everywhere else. Create View 00
--             first; every other view depends only on it.
-- ============================================================================


-- ============================================================================
-- 00. vw_cfpb_base
-- What it is : Normalized foundation view. Renames space-containing columns,
--              derives day/week/month buckets, zip3, routing lag, and clean
--              boolean flags.
-- Inference  : None directly — this is plumbing. Everything downstream reads
--              from here so a schema change only has to be fixed once.
-- ============================================================================
CREATE OR REPLACE VIEW vw_cfpb_base AS
SELECT
    "complaint id"                                   AS complaint_id,
    "missing complaint id"                           AS missing_complaint_id,
    "date received"                                  AS date_received,
    "date sent to company"                           AS date_sent_to_company,
    CAST(date_trunc('day',   "date received") AS date) AS day_received,
    CAST(date_trunc('week',  "date received") AS date) AS week_received,
    CAST(date_trunc('month', "date received") AS date) AS month_received,
    COALESCE(NULLIF(TRIM(product), ''),     'UNKNOWN') AS product,
    COALESCE(NULLIF(TRIM("sub-product"), ''),'UNKNOWN') AS sub_product,
    COALESCE(NULLIF(TRIM(issue), ''),       'UNKNOWN') AS issue,
    COALESCE(NULLIF(TRIM("sub-issue"), ''), 'UNKNOWN') AS sub_issue,
    "consumer complaint narrative"                   AS narrative,
    "company public response"                        AS company_public_response,
    company,
    UPPER(TRIM(state))                               AS state,
    "zip code"                                       AS zip_code,
    CASE WHEN regexp_like("zip code", '^[0-9]{3}')
         THEN substr("zip code", 1, 3) END           AS zip3,
    tags,
    "submitted via"                                  AS submitted_via,
    "company response to consumer"                   AS company_response,
    "timely response?"                               AS timely_response,
    date_diff('day', "date received", "date sent to company") AS routing_lag_days,
    ("consumer complaint narrative" IS NOT NULL
     AND TRIM("consumer complaint narrative") <> '')          AS has_narrative,
    ("company response to consumer" = 'Closed with monetary relief')     AS is_monetary_relief,
    ("company response to consumer" = 'Closed with non-monetary relief') AS is_nonmonetary_relief,
    ("company response to consumer" = 'In progress')                     AS is_in_progress,
    (tags LIKE '%Servicemember%')                    AS is_servicemember,
    (tags LIKE '%Older American%')                   AS is_older_american
FROM cfpb_db.complaints;


-- ############################################################################
-- SECTION 1 — VOLUME & VELOCITY
-- ############################################################################

-- ============================================================================
-- 01. vw_volume_daily
-- What it is : Complaint count per day with 7-day and 30-day rolling averages
--              and day-over-day / week-over-week deltas.
-- Inference  : The heartbeat of the stream. Sustained rise in the 7d avg above
--              the 30d avg = building problem; a one-day spike with flat
--              rolling averages = noise or a data dump, not an incident.
-- ============================================================================
CREATE OR REPLACE VIEW vw_volume_daily AS
WITH daily AS (
    SELECT day_received, COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY day_received
)
SELECT
    day_received,
    complaints,
    AVG(complaints)  OVER w7   AS avg_7d,
    AVG(complaints)  OVER w30  AS avg_30d,
    complaints - LAG(complaints, 1)  OVER (ORDER BY day_received) AS dod_change,
    complaints - LAG(complaints, 7)  OVER (ORDER BY day_received) AS wow_change,
    CASE WHEN LAG(complaints, 7) OVER (ORDER BY day_received) > 0
         THEN ROUND(100.0 * (complaints - LAG(complaints, 7) OVER (ORDER BY day_received))
              / LAG(complaints, 7) OVER (ORDER BY day_received), 1)
    END AS wow_pct_change
FROM daily
WINDOW
    w7  AS (ORDER BY day_received ROWS BETWEEN 6  PRECEDING AND CURRENT ROW),
    w30 AS (ORDER BY day_received ROWS BETWEEN 29 PRECEDING AND CURRENT ROW);


-- ============================================================================
-- 02. vw_volume_anomaly_product_issue
-- What it is : Daily count per product x issue with a z-score vs. that pair's
--              own trailing 28-day mean/stddev. Flags |z| >= 3.
-- Inference  : Statistical early warning at the level where root causes live.
--              A z>=3 flag on one product x issue pair two weeks after a
--              system release or fee change points you straight at the cause.
-- ============================================================================
CREATE OR REPLACE VIEW vw_volume_anomaly_product_issue AS
WITH daily AS (
    SELECT day_received, product, issue, COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY day_received, product, issue
),
stats AS (
    SELECT
        day_received, product, issue, complaints,
        AVG(complaints)        OVER trail AS baseline_avg,
        STDDEV_POP(complaints) OVER trail AS baseline_std
    FROM daily
    WINDOW trail AS (PARTITION BY product, issue ORDER BY day_received
                     ROWS BETWEEN 28 PRECEDING AND 1 PRECEDING)
)
SELECT
    day_received, product, issue, complaints,
    ROUND(baseline_avg, 2) AS baseline_avg,
    CASE WHEN baseline_std > 0
         THEN ROUND((complaints - baseline_avg) / baseline_std, 2) END AS z_score,
    (baseline_std > 0 AND ABS(complaints - baseline_avg) / baseline_std >= 3) AS is_anomaly
FROM stats;


-- ============================================================================
-- 04. vw_volume_seasonality
-- What it is : Average complaint volume by day-of-week and by month-of-year.
-- Inference  : Your expected baseline shape. Mondays and post-holiday months
--              run hot; comparing a raw Tuesday to a raw Monday without this
--              produces false alarms. Use it to calibrate alert thresholds.
-- ============================================================================
CREATE OR REPLACE VIEW vw_volume_seasonality AS
WITH daily AS (
    SELECT day_received, COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY day_received
)
SELECT
    day_of_week(day_received) AS dow,          -- 1 = Monday
    month(day_received)       AS month_of_year,
    AVG(complaints)           AS avg_complaints,
    COUNT(*)                  AS days_observed
FROM daily
GROUP BY day_of_week(day_received), month(day_received);


-- ############################################################################
-- SECTION 2 — COMPOSITION & TAXONOMY
-- ############################################################################

-- ============================================================================
-- 05. vw_mix_product_monthly
-- What it is : Monthly complaint count and share by product/sub-product, with
--              share change vs. prior month.
-- Inference  : Mix shift detection. Total volume can be flat while one product
--              quietly doubles its share — that hidden rotation is what this
--              surfaces.
-- ============================================================================
CREATE OR REPLACE VIEW vw_mix_product_monthly AS
WITH m AS (
    SELECT month_received, product, sub_product, COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY month_received, product, sub_product
),
shares AS (
    SELECT
        month_received, product, sub_product, complaints,
        ROUND(100.0 * complaints / SUM(complaints) OVER (PARTITION BY month_received), 2) AS share_pct
    FROM m
)
SELECT
    month_received, product, sub_product, complaints, share_pct,
    share_pct - LAG(share_pct) OVER (PARTITION BY product, sub_product
                                     ORDER BY month_received) AS share_pct_change_mom
FROM shares;


-- ============================================================================
-- 06. vw_fastest_growing_issues
-- What it is : Month-over-month growth rate per issue/sub-issue, ranked, with
--              a minimum-volume floor to suppress tiny-base noise.
-- Inference  : "What's getting worse fastest" rather than "what's biggest."
--              The top of this list is next quarter's biggest category if
--              nothing is done.
-- ============================================================================
CREATE OR REPLACE VIEW vw_fastest_growing_issues AS
WITH m AS (
    SELECT month_received, issue, sub_issue, COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY month_received, issue, sub_issue
),
g AS (
    SELECT
        month_received, issue, sub_issue, complaints,
        LAG(complaints) OVER (PARTITION BY issue, sub_issue
                              ORDER BY month_received) AS prev_complaints
    FROM m
)
SELECT
    month_received, issue, sub_issue, complaints, prev_complaints,
    ROUND(100.0 * (complaints - prev_complaints) / prev_complaints, 1) AS mom_growth_pct,
    RANK() OVER (PARTITION BY month_received
                 ORDER BY (complaints - prev_complaints) * 1.0 / prev_complaints DESC) AS growth_rank
FROM g
WHERE prev_complaints >= 10;   -- volume floor: tune to your scale


-- ============================================================================
-- 07. vw_product_issue_heatmap
-- What it is : Monthly counts for every product x issue pair plus each pair's
--              share of that product's complaints.
-- Inference  : Concentration hotspots. One issue holding >40% of a product's
--              complaints is a single fixable root cause, not diffuse
--              dissatisfaction.
-- ============================================================================
CREATE OR REPLACE VIEW vw_product_issue_heatmap AS
SELECT
    month_received, product, issue,
    COUNT(*) AS complaints,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY month_received, product), 2)
        AS pct_of_product
FROM vw_cfpb_base
GROUP BY month_received, product, issue;


-- ============================================================================
-- 08. vw_issue_concentration_hhi
-- What it is : Herfindahl-Hirschman index of issue shares within each product,
--              per month (sum of squared shares; 10,000 = one issue only).
-- Inference  : Rising HHI = complaints consolidating around one failure mode
--              (fix one thing, win big). Falling HHI = broad, diffuse
--              dissatisfaction (harder, more systemic problem).
-- ============================================================================
CREATE OR REPLACE VIEW vw_issue_concentration_hhi AS
WITH shares AS (
    SELECT
        month_received, product, issue,
        100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY month_received, product) AS share_pct
    FROM vw_cfpb_base
    GROUP BY month_received, product, issue
)
SELECT
    month_received, product,
    ROUND(SUM(share_pct * share_pct), 0) AS hhi
FROM shares
GROUP BY month_received, product;


-- ============================================================================
-- 09. vw_new_subissue_emergence
-- What it is : First-seen date for each company x sub-issue combination,
--              flagged if it first appeared within the last 90 days.
-- Inference  : A sub-issue appearing for the first time against a company is
--              often a new product, new fee, or new process failure. Cheap
--              structured-data substitute for NLP topic detection.
-- ============================================================================
CREATE OR REPLACE VIEW vw_new_subissue_emergence AS
WITH firsts AS (
    SELECT
        company, product, sub_issue,
        MIN(day_received) AS first_seen,
        COUNT(*)          AS total_complaints
    FROM vw_cfpb_base
    WHERE sub_issue <> 'UNKNOWN'
    GROUP BY company, product, sub_issue
)
SELECT
    company, product, sub_issue, first_seen, total_complaints,
    (first_seen >= date_add('day', -90, current_date)) AS is_newly_emerged
FROM firsts;


-- ############################################################################
-- SECTION 3 — GEOGRAPHIC
-- ############################################################################

-- ============================================================================
-- 10. vw_geo_state_monthly
-- What it is : Monthly complaint counts and national share per state, with
--              month-over-month growth.
-- Inference  : Regional problem detection — a state outgrowing the national
--              trend points at a regional operation, a state-specific
--              regulation change, or a localized fraud pattern.
-- ============================================================================
CREATE OR REPLACE VIEW vw_geo_state_monthly AS
WITH m AS (
    SELECT month_received, state, COUNT(*) AS complaints
    FROM vw_cfpb_base
    WHERE state IS NOT NULL AND state <> ''
    GROUP BY month_received, state
)
SELECT
    month_received, state, complaints,
    ROUND(100.0 * complaints / SUM(complaints) OVER (PARTITION BY month_received), 2)
        AS national_share_pct,
    ROUND(100.0 * (complaints - LAG(complaints) OVER (PARTITION BY state ORDER BY month_received))
          / NULLIF(LAG(complaints) OVER (PARTITION BY state ORDER BY month_received), 0), 1)
        AS mom_growth_pct
FROM m;


-- ============================================================================
-- 11. vw_geo_state_anomaly
-- What it is : Monthly state counts with a z-score against each state's own
--              trailing 6-month baseline.
-- Inference  : Separates "Texas is always big" from "Texas just deviated from
--              its own normal" — only the latter is actionable.
-- ============================================================================
CREATE OR REPLACE VIEW vw_geo_state_anomaly AS
WITH m AS (
    SELECT month_received, state, COUNT(*) AS complaints
    FROM vw_cfpb_base
    WHERE state IS NOT NULL AND state <> ''
    GROUP BY month_received, state
),
stats AS (
    SELECT
        month_received, state, complaints,
        AVG(complaints)        OVER trail AS baseline_avg,
        STDDEV_POP(complaints) OVER trail AS baseline_std
    FROM m
    WINDOW trail AS (PARTITION BY state ORDER BY month_received
                     ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING)
)
SELECT
    month_received, state, complaints,
    ROUND(baseline_avg, 1) AS baseline_avg,
    CASE WHEN baseline_std > 0
         THEN ROUND((complaints - baseline_avg) / baseline_std, 2) END AS z_score,
    (baseline_std > 0 AND (complaints - baseline_avg) / baseline_std >= 3) AS is_spike
FROM stats;


-- ============================================================================
-- 12. vw_geo_zip_coverage
-- What it is : Monthly rate of usable (parseable) zip codes vs. masked/null.
-- Inference  : A denominator-honesty view. If only 60% of records have a real
--              zip, every ZIP3-level conclusion carries that caveat. A drop in
--              coverage also signals an upstream masking/format change.
-- ============================================================================
CREATE OR REPLACE VIEW vw_geo_zip_coverage AS
SELECT
    month_received,
    COUNT(*)                                          AS total,
    SUM(CASE WHEN zip3 IS NOT NULL THEN 1 ELSE 0 END) AS usable_zip,
    ROUND(100.0 * SUM(CASE WHEN zip3 IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 2)
        AS zip_coverage_pct
FROM vw_cfpb_base
GROUP BY month_received;


-- ############################################################################
-- SECTION 4 — CHANNEL & POPULATION
-- ############################################################################

-- ============================================================================
-- 13. vw_channel_mix_monthly
-- What it is : Monthly complaint share by submission channel (Web, Phone,
--              Referral, Postal mail, Fax) with share change.
-- Inference  : A rising Referral share matters most — referrals typically
--              arrive via other regulators or agencies, so growth there is a
--              soft signal of regulatory attention. Channel shifts also hint
--              at changes in *who* is complaining.
-- ============================================================================
CREATE OR REPLACE VIEW vw_channel_mix_monthly AS
WITH m AS (
    SELECT month_received, submitted_via, COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY month_received, submitted_via
)
SELECT
    month_received, submitted_via, complaints,
    ROUND(100.0 * complaints / SUM(complaints) OVER (PARTITION BY month_received), 2)
        AS share_pct,
    ROUND(100.0 * complaints / SUM(complaints) OVER (PARTITION BY month_received), 2)
      - LAG(ROUND(100.0 * complaints / SUM(complaints) OVER (PARTITION BY month_received), 2))
        OVER (PARTITION BY submitted_via ORDER BY month_received)
        AS share_pct_change_mom
FROM m;


-- ============================================================================
-- 14. vw_protected_population_trends
-- What it is : Monthly counts and share of Servicemember and Older American
--              tagged complaints, by product.
-- Inference  : Regulatorily sensitive populations with dedicated CFPB offices.
--              Elevated or rising shares here carry outsized exam and
--              reputational risk relative to raw volume.
-- ============================================================================
CREATE OR REPLACE VIEW vw_protected_population_trends AS
SELECT
    month_received, product,
    COUNT(*)                                            AS total_complaints,
    SUM(CASE WHEN is_servicemember  THEN 1 ELSE 0 END)  AS servicemember_complaints,
    SUM(CASE WHEN is_older_american THEN 1 ELSE 0 END)  AS older_american_complaints,
    ROUND(100.0 * SUM(CASE WHEN is_servicemember  THEN 1 ELSE 0 END) / COUNT(*), 2)
        AS servicemember_pct,
    ROUND(100.0 * SUM(CASE WHEN is_older_american THEN 1 ELSE 0 END) / COUNT(*), 2)
        AS older_american_pct
FROM vw_cfpb_base
GROUP BY month_received, product;


-- ############################################################################
-- SECTION 5 — RESPONSE PERFORMANCE & OUTCOMES
-- ############################################################################

-- ============================================================================
-- 15. vw_timely_response_rate
-- What it is : Monthly timely-response rate overall and by company x product.
-- Inference  : A direct compliance obligation visible to the CFPB. Any decline
--              is an operational capacity problem in complaint handling and a
--              near-certain exam finding if sustained.
-- ============================================================================
CREATE OR REPLACE VIEW vw_timely_response_rate AS
SELECT
    month_received, company, product,
    COUNT(*) AS complaints,
    ROUND(100.0 * SUM(CASE WHEN timely_response THEN 1 ELSE 0 END) / COUNT(*), 2)
        AS timely_pct
FROM vw_cfpb_base
GROUP BY month_received, company, product;


-- ============================================================================
-- 16. vw_routing_lag
-- What it is : Distribution of days between date received and date sent to
--              company (avg, median, p90) per month.
-- Inference  : Measures CFPB routing, not company handling — but a routing
--              slowdown compresses the effective 15-day response window, so it
--              is context you need when interpreting timeliness dips.
-- ============================================================================
CREATE OR REPLACE VIEW vw_routing_lag AS
SELECT
    month_received,
    COUNT(*)                                    AS complaints,
    ROUND(AVG(routing_lag_days), 2)             AS avg_lag_days,
    approx_percentile(routing_lag_days, 0.5)    AS median_lag_days,
    approx_percentile(routing_lag_days, 0.9)    AS p90_lag_days
FROM vw_cfpb_base
WHERE routing_lag_days IS NOT NULL AND routing_lag_days >= 0
GROUP BY month_received;


-- ============================================================================
-- 17. vw_response_type_distribution
-- What it is : Monthly distribution of company response categories per
--              company x product (explanation / monetary / non-monetary /
--              in progress / other).
-- Inference  : The outcome mix. Watch monetary relief share in View 18; also
--              watch "Closed with explanation" creeping toward 100%, which can
--              indicate a template-response culture that regulators flag.
-- ============================================================================
CREATE OR REPLACE VIEW vw_response_type_distribution AS
SELECT
    month_received, company, product, company_response,
    COUNT(*) AS complaints,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY month_received, company, product), 2)
        AS pct_of_responses
FROM vw_cfpb_base
GROUP BY month_received, company, product, company_response;


-- ============================================================================
-- 18. vw_monetary_relief_rate
-- What it is : Monthly share of complaints closed with monetary relief, by
--              company x product x issue, with trend vs. prior month.
-- Inference  : The strongest single systemic-issue proxy in the public data.
--              A rising monetary relief rate on one product x issue means the
--              bank is repeatedly paying to close the same problem — exactly
--              what UDAAP exams look for. (Amounts are not public; rate only.)
-- ============================================================================
CREATE OR REPLACE VIEW vw_monetary_relief_rate AS
WITH m AS (
    SELECT
        month_received, company, product, issue,
        COUNT(*) AS complaints,
        SUM(CASE WHEN is_monetary_relief THEN 1 ELSE 0 END) AS monetary_relief
    FROM vw_cfpb_base
    GROUP BY month_received, company, product, issue
)
SELECT
    month_received, company, product, issue, complaints, monetary_relief,
    ROUND(100.0 * monetary_relief / complaints, 2) AS monetary_relief_pct,
    ROUND(100.0 * monetary_relief / complaints, 2)
      - LAG(ROUND(100.0 * monetary_relief / complaints, 2))
        OVER (PARTITION BY company, product, issue ORDER BY month_received)
        AS relief_pct_change_mom
FROM m;


-- ============================================================================
-- 19. vw_open_backlog_aging
-- What it is : All complaints currently marked "In progress," with age in days
--              and aging buckets.
-- Inference  : The live workload queue. Anything aging past ~15 days from
--              date sent is at risk of becoming an untimely response; the
--              bucket distribution tells you if backlog is building.
-- ============================================================================
CREATE OR REPLACE VIEW vw_open_backlog_aging AS
SELECT
    complaint_id, company, product, issue,
    day_received,
    date_diff('day', date_sent_to_company, current_timestamp) AS age_days_since_sent,
    CASE
        WHEN date_diff('day', date_sent_to_company, current_timestamp) <= 7  THEN '0-7d'
        WHEN date_diff('day', date_sent_to_company, current_timestamp) <= 15 THEN '8-15d'
        WHEN date_diff('day', date_sent_to_company, current_timestamp) <= 30 THEN '16-30d'
        ELSE '30d+'
    END AS aging_bucket
FROM vw_cfpb_base
WHERE is_in_progress;


-- ============================================================================
-- 20. vw_public_response_usage
-- What it is : Monthly rate of complaints carrying a company public response,
--              and the distribution of the canned categories used.
-- Inference  : A communications-posture metric. Heavy use of deflecting
--              categories (e.g., "...believes complaint is the result of a
--              misunderstanding") reads poorly in aggregate to journalists and
--              regulators mining the same public data.
-- ============================================================================
CREATE OR REPLACE VIEW vw_public_response_usage AS
WITH cat AS (
    SELECT
        month_received, company,
        COALESCE(NULLIF(TRIM(company_public_response), ''), '(none)') AS public_response_category,
        COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY month_received, company,
             COALESCE(NULLIF(TRIM(company_public_response), ''), '(none)')
)
SELECT
    month_received, company, public_response_category, complaints,
    ROUND(100.0 * complaints
          / SUM(complaints) OVER (PARTITION BY month_received, company), 2)
        AS pct_of_company_complaints,
    ROUND(100.0 * SUM(CASE WHEN public_response_category <> '(none)' THEN complaints ELSE 0 END)
                  OVER (PARTITION BY month_received, company)
          / SUM(complaints) OVER (PARTITION BY month_received, company), 2)
        AS overall_public_response_usage_pct
FROM cat;


-- ############################################################################
-- SECTION 6 — COMPARATIVE / BENCHMARK
-- ############################################################################

-- ============================================================================
-- 21. vw_company_rank_by_product
-- What it is : Monthly complaint volume rank per company within each product,
--              plus rank movement vs. prior month.
-- Inference  : The league table journalists and regulators build. Moving up
--              (worse) in rank matters even when your absolute volume is flat,
--              because it means peers improved and you did not.
-- ============================================================================
CREATE OR REPLACE VIEW vw_company_rank_by_product AS
WITH m AS (
    SELECT month_received, product, company, COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY month_received, product, company
),
ranked AS (
    SELECT
        month_received, product, company, complaints,
        RANK() OVER (PARTITION BY month_received, product ORDER BY complaints DESC) AS complaint_rank
    FROM m
)
SELECT
    month_received, product, company, complaints, complaint_rank,
    complaint_rank - LAG(complaint_rank) OVER (PARTITION BY product, company
                                               ORDER BY month_received) AS rank_change
FROM ranked;


-- ============================================================================
-- 22. vw_peer_growth_divergence
-- What it is : Each company's MoM growth per product minus the median growth
--              of all companies in that product that month.
-- Inference  : The systemic-vs-idiosyncratic separator. If the whole industry
--              is up 20% and you are up 20%, it is a market phenomenon; if the
--              median is +5% and you are +60%, the problem is yours.
-- ============================================================================
CREATE OR REPLACE VIEW vw_peer_growth_divergence AS
WITH m AS (
    SELECT month_received, product, company, COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY month_received, product, company
),
g AS (
    SELECT
        month_received, product, company, complaints,
        100.0 * (complaints - LAG(complaints) OVER (PARTITION BY product, company ORDER BY month_received))
              / NULLIF(LAG(complaints) OVER (PARTITION BY product, company ORDER BY month_received), 0)
            AS mom_growth_pct
    FROM m
),
med AS (
    SELECT
        month_received, product,
        approx_percentile(mom_growth_pct, 0.5) AS peer_median_growth_pct
    FROM g
    WHERE mom_growth_pct IS NOT NULL
    GROUP BY month_received, product
)
SELECT
    g.month_received, g.product, g.company, g.complaints,
    ROUND(g.mom_growth_pct, 1)                              AS mom_growth_pct,
    ROUND(med.peer_median_growth_pct, 1)                    AS peer_median_growth_pct,
    ROUND(g.mom_growth_pct - med.peer_median_growth_pct, 1) AS divergence_pts
FROM g
JOIN med
  ON g.month_received = med.month_received AND g.product = med.product
WHERE g.mom_growth_pct IS NOT NULL;


-- ############################################################################
-- SECTION 7 — TEXT / NARRATIVE SIGNALS
-- ############################################################################

-- ============================================================================
-- 23. vw_narrative_optin_rate
-- What it is : Monthly share of complaints that include a consumer narrative.
-- Inference  : The coverage denominator for every text metric below. If only
--              ~35-40% of complaints have narratives (typical), text-based
--              rates describe that subset, not all complaints — and opt-in
--              consumers skew more motivated/aggrieved.
-- ============================================================================
CREATE OR REPLACE VIEW vw_narrative_optin_rate AS
SELECT
    month_received,
    COUNT(*) AS complaints,
    SUM(CASE WHEN has_narrative THEN 1 ELSE 0 END) AS with_narrative,
    ROUND(100.0 * SUM(CASE WHEN has_narrative THEN 1 ELSE 0 END) / COUNT(*), 2)
        AS narrative_pct
FROM vw_cfpb_base
GROUP BY month_received;


-- ============================================================================
-- 24. vw_udaap_language_rate
-- What it is : Among narratives, the monthly rate (by company x product) that
--              contain UDAAP-adjacent language: deceptive, misled, hidden fee,
--              never disclosed, discriminat*, bait and switch, predatory,
--              fraud, scam.
-- Inference  : A leading indicator of unfair/deceptive/abusive-practices risk.
--              Rising rates on one product are worth escalating to compliance
--              before an examiner runs the same regex on the same public data.
-- ============================================================================
CREATE OR REPLACE VIEW vw_udaap_language_rate AS
SELECT
    month_received, company, product,
    SUM(CASE WHEN has_narrative THEN 1 ELSE 0 END) AS narratives,
    SUM(CASE WHEN has_narrative AND regexp_like(lower(narrative),
        'decept|misled|mislead|hidden fee|never disclosed|discriminat|bait and switch|predator|fraud|scam')
        THEN 1 ELSE 0 END) AS udaap_flagged,
    ROUND(100.0 * SUM(CASE WHEN has_narrative AND regexp_like(lower(narrative),
        'decept|misled|mislead|hidden fee|never disclosed|discriminat|bait and switch|predator|fraud|scam')
        THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN has_narrative THEN 1 ELSE 0 END), 0), 2) AS udaap_flag_pct
FROM vw_cfpb_base
GROUP BY month_received, company, product;


-- ============================================================================
-- 25. vw_legal_escalation_rate
-- What it is : Among narratives, the monthly rate mentioning attorneys,
--              lawsuits, class actions, attorneys general, CFPB enforcement,
--              or small claims.
-- Inference  : A precursor signal for litigation and regulatory referral.
--              Clusters of legal language around one product x issue often
--              precede class-action filings by weeks to months.
-- ============================================================================
CREATE OR REPLACE VIEW vw_legal_escalation_rate AS
SELECT
    month_received, company, product, issue,
    SUM(CASE WHEN has_narrative THEN 1 ELSE 0 END) AS narratives,
    SUM(CASE WHEN has_narrative AND regexp_like(lower(narrative),
        'attorney|lawyer|lawsuit|class action|sue |suing|legal action|small claims|attorney general')
        THEN 1 ELSE 0 END) AS legal_flagged,
    ROUND(100.0 * SUM(CASE WHEN has_narrative AND regexp_like(lower(narrative),
        'attorney|lawyer|lawsuit|class action|sue |suing|legal action|small claims|attorney general')
        THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN has_narrative THEN 1 ELSE 0 END), 0), 2) AS legal_flag_pct
FROM vw_cfpb_base
GROUP BY month_received, company, product, issue;


-- ############################################################################
-- SECTION 8 — CROSS-FIELD DERIVED SIGNALS
-- ############################################################################

-- ============================================================================
-- 26. vw_zip3_subissue_clusters
-- What it is : Monthly company x sub-issue x ZIP3 counts, flagged where a
--              single ZIP3 holds >= 5 complaints AND >= 25% of that company's
--              complaints for that sub-issue.
-- Inference  : Localized operational failure detector — one branch region,
--              one servicing site, or one local fraud ring. Also the closest
--              this schema gets to a repeat-complainant proxy, since there is
--              no consumer identifier.
-- ============================================================================
CREATE OR REPLACE VIEW vw_zip3_subissue_clusters AS
WITH c AS (
    SELECT month_received, company, sub_issue, zip3, COUNT(*) AS complaints
    FROM vw_cfpb_base
    WHERE zip3 IS NOT NULL AND sub_issue <> 'UNKNOWN'
    GROUP BY month_received, company, sub_issue, zip3
),
tot AS (
    SELECT month_received, company, sub_issue, SUM(complaints) AS total_complaints
    FROM c
    GROUP BY month_received, company, sub_issue
)
SELECT
    c.month_received, c.company, c.sub_issue, c.zip3,
    c.complaints, tot.total_complaints,
    ROUND(100.0 * c.complaints / tot.total_complaints, 1) AS zip3_share_pct,
    (c.complaints >= 5 AND c.complaints * 1.0 / tot.total_complaints >= 0.25) AS is_cluster
FROM c
JOIN tot USING (month_received, company, sub_issue);


-- ============================================================================
-- 27. vw_attention_index
-- What it is : A monthly composite score per company x product combining three
--              normalized signals: volume growth (40%), monetary relief rate
--              (30%), and UDAAP language rate (30%). Score 0-100.
-- Inference  : A single triage number for dashboards: which product deserves
--              attention THIS month. The weights are starting points — tune
--              them against incidents your bank actually confirmed.
-- ============================================================================
CREATE OR REPLACE VIEW vw_attention_index AS
WITH vol AS (
    SELECT
        month_received, company, product, COUNT(*) AS complaints,
        100.0 * (COUNT(*) - LAG(COUNT(*)) OVER (PARTITION BY company, product ORDER BY month_received))
              / NULLIF(LAG(COUNT(*)) OVER (PARTITION BY company, product ORDER BY month_received), 0)
            AS growth_pct
    FROM vw_cfpb_base
    GROUP BY month_received, company, product
),
relief AS (
    SELECT
        month_received, company, product,
        100.0 * SUM(CASE WHEN is_monetary_relief THEN 1 ELSE 0 END) / COUNT(*) AS relief_pct
    FROM vw_cfpb_base
    GROUP BY month_received, company, product
),
udaap AS (
    SELECT
        month_received, company, product,
        100.0 * SUM(CASE WHEN has_narrative AND regexp_like(lower(narrative),
            'decept|misled|mislead|hidden fee|never disclosed|discriminat|predator|fraud|scam')
            THEN 1 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN has_narrative THEN 1 ELSE 0 END), 0) AS udaap_pct
    FROM vw_cfpb_base
    GROUP BY month_received, company, product
)
SELECT
    v.month_received, v.company, v.product, v.complaints,
    ROUND(v.growth_pct, 1)  AS growth_pct,
    ROUND(r.relief_pct, 1)  AS relief_pct,
    ROUND(u.udaap_pct, 1)   AS udaap_pct,
    ROUND(
        0.4 * LEAST(GREATEST(COALESCE(v.growth_pct, 0), 0), 100)
      + 0.3 * LEAST(COALESCE(r.relief_pct, 0), 100)
      + 0.3 * LEAST(COALESCE(u.udaap_pct, 0), 100)
    , 1) AS attention_score
FROM vol v
LEFT JOIN relief r USING (month_received, company, product)
LEFT JOIN udaap  u USING (month_received, company, product)
WHERE v.complaints >= 10;   -- volume floor to suppress small-sample noise


-- ============================================================================
-- END OF LIBRARY — 28 views total (00 base + 27 metrics)
-- Deployment order: View 00 first, then any others in any order.
-- ============================================================================