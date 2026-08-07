CREATE OR REPLACE VIEW "cfpb-complaints".vw_geo_state_anomaly AS
WITH
  data_cutoff AS (
   SELECT
     MAX(CAST(day_received AS DATE)) data_through_date
   FROM
     vw_cfpb_base
)
, m AS (
   SELECT
     CAST(month_received AS DATE) month_received
   , state
   , COUNT(*) complaints
   FROM
     vw_cfpb_base
   WHERE ((state IS NOT NULL) AND (state <> ''))
   GROUP BY CAST(month_received AS DATE), state
)
, m_progress AS (
   -- Elapsed days let the current (in-progress) month be compared on the
   -- same time basis as complete historical months instead of always
   -- reading low against a full-month baseline.
   SELECT
     m.month_received
   , m.state
   , m.complaints
   , (CASE
        WHEN m.month_received = DATE_TRUNC('month', c.data_through_date)
          THEN (DATE_DIFF('day', m.month_received, c.data_through_date) + 1)
        ELSE DAY(LAST_DAY_OF_MONTH(m.month_received))
      END) days_elapsed
   FROM
     m
   CROSS JOIN data_cutoff c
)
, rates AS (
   SELECT
     month_received
   , state
   , complaints
   , days_elapsed
   , (CAST(complaints AS DOUBLE) / NULLIF(days_elapsed, 0)) avg_daily_complaints
   FROM
     m_progress
)
, stats AS (
   SELECT
     month_received
   , state
   , complaints
   , days_elapsed
   , AVG(avg_daily_complaints) OVER trail baseline_avg_daily
   , STDDEV_SAMP(avg_daily_complaints) OVER trail baseline_std_daily
   FROM
     rates
   WINDOW trail AS (PARTITION BY state ORDER BY month_received ASC ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING)
)
, scoped AS (
   -- Baseline avg/std projected onto this row's own elapsed-day window, so
   -- a partial current month is compared against an equally partial
   -- expectation rather than a full trailing month.
   SELECT
     month_received
   , state
   , complaints
   , (baseline_avg_daily * days_elapsed) baseline_avg
   , (baseline_std_daily * SQRT(days_elapsed)) baseline_std
   FROM
     stats
)
SELECT
  month_received
, state
, complaints
, ROUND(baseline_avg, 1) baseline_avg
, (CASE WHEN (baseline_std > 0) THEN ROUND(((complaints - baseline_avg) / baseline_std), 2) END) z_score
, ((baseline_std > 0)
    AND (complaints >= 10)
    AND ((ABS((complaints - baseline_avg)) / baseline_std) >= 3)
  ) is_spike
FROM
  scoped
