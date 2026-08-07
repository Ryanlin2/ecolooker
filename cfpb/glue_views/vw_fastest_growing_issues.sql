CREATE OR REPLACE VIEW "cfpb-complaints".vw_fastest_growing_issues AS

WITH data_cutoff AS (
    SELECT
        MAX(CAST(day_received AS DATE)) AS data_through_date
    FROM vw_cfpb_base
),

monthly_complaints AS (
    SELECT
        CAST(month_received AS DATE) AS month_received,
        issue,
        sub_issue,
        COUNT(*) AS complaints
    FROM vw_cfpb_base
    GROUP BY
        CAST(month_received AS DATE),
        issue,
        sub_issue
),

month_progress AS (
    SELECT
        m.month_received,
        m.issue,
        m.sub_issue,
        m.complaints,

        DAY(
            LAST_DAY_OF_MONTH(m.month_received)
        ) AS days_in_month,

        CASE
            -- For the current data month, use the number of elapsed
            -- days represented in the dataset.
            WHEN m.month_received =
                 DATE_TRUNC('month', c.data_through_date)
            THEN DATE_DIFF(
                     'day',
                     m.month_received,
                     c.data_through_date
                 ) + 1

            -- Historical months are complete.
            ELSE DAY(
                     LAST_DAY_OF_MONTH(m.month_received)
                 )
        END AS days_elapsed

    FROM monthly_complaints m
    CROSS JOIN data_cutoff c
),

monthly_rates AS (
    SELECT
        month_received,
        issue,
        sub_issue,
        complaints,
        days_elapsed,
        days_in_month,

        CAST(complaints AS DOUBLE)
            / NULLIF(days_elapsed, 0)
            AS avg_daily_complaints

    FROM month_progress
),

with_previous_month AS (
    SELECT
        month_received,
        issue,
        sub_issue,
        complaints,
        days_elapsed,
        days_in_month,
        avg_daily_complaints,

        LAG(month_received) OVER (
            PARTITION BY issue, sub_issue
            ORDER BY month_received
        ) AS prev_month_received,

        LAG(complaints) OVER (
            PARTITION BY issue, sub_issue
            ORDER BY month_received
        ) AS prev_complaints,

        LAG(days_in_month) OVER (
            PARTITION BY issue, sub_issue
            ORDER BY month_received
        ) AS prev_days_in_month,

        LAG(avg_daily_complaints) OVER (
            PARTITION BY issue, sub_issue
            ORDER BY month_received
        ) AS prev_avg_daily_complaints

    FROM monthly_rates
),

with_expected_value AS (
    SELECT
        month_received,
        issue,
        sub_issue,
        complaints,
        days_elapsed,
        days_in_month,
        avg_daily_complaints,
        prev_month_received,
        prev_complaints,
        prev_days_in_month,
        prev_avg_daily_complaints,

        /*
         * Expected complaints through the current point in the month:
         *
         * previous month's daily average
         *     ×
         * days elapsed in the current month
         */
        prev_avg_daily_complaints * days_elapsed
            AS expected_complaints_to_date

    FROM with_previous_month
),

positive_growth AS (
    SELECT
        month_received,
        issue,
        sub_issue,

        complaints AS complaints_to_date,
        days_elapsed,
        days_in_month,

        ROUND(
            avg_daily_complaints,
            2
        ) AS avg_daily_complaints,

        prev_complaints,

        ROUND(
            prev_avg_daily_complaints,
            2
        ) AS prev_avg_daily_complaints,

        ROUND(
            expected_complaints_to_date,
            1
        ) AS expected_complaints_to_date,

        ROUND(
            complaints - expected_complaints_to_date,
            0
        ) AS complaints_above_expected,

        ROUND(
            100.0
            * (
                complaints - expected_complaints_to_date
            )
            / NULLIF(expected_complaints_to_date, 0),
            1
        ) AS growth_vs_expected_pct

    FROM with_expected_value

    WHERE
        -- Only compare consecutive calendar months.
        DATE_DIFF(
            'month',
            prev_month_received,
            month_received
        ) = 1

        -- Avoid unstable comparisons from a tiny prior-month baseline.
        AND prev_complaints >= 10

        -- Include only categories currently above the expected pace.
        AND complaints > expected_complaints_to_date
)

SELECT
    month_received,
    issue,
    sub_issue,
    complaints_to_date,
    days_elapsed,
    days_in_month,
    avg_daily_complaints,
    prev_complaints,
    prev_avg_daily_complaints,
    expected_complaints_to_date,
    complaints_above_expected,
    growth_vs_expected_pct,

    RANK() OVER (
        PARTITION BY month_received
        ORDER BY growth_vs_expected_pct DESC
    ) AS growth_rank

FROM positive_growth;