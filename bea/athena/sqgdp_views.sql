-- =============================================================================
-- Athena views backing the "US Industry GDP" dashboard
-- (ecolooker-webapp/.../dashboards/us-industry-gdp).
--
-- Source: bea.sqgdp_state_gdp (Iceberg table populated by
-- bea/glue/sqgdp_iceberg_job.py / bea/sqgdp_data/transform_sqgdp.py), schema:
--   geo_fips, geo_name, region, table_name, line_code,
--   industry_classification, description, unit, year, quarter,
--   period_date, value, source_file, ingested_at
--
-- All views read from table_name = 'SQGDP9' ("Real GDP by state", millions
-- of chained 2017 dollars, by industry) -- that's the table the dashboard's
-- "chained dollars" figures are modeled on.
--
-- Line-code reference (from SQGDP9__definition.xml):
--   1  = All industry total
--   2  = Private industries            <- subtotal of the leaf codes below, excluded
--   12 = Manufacturing                 <- leaf; 13/25 (durable/nondurable) are its children, excluded
--   83 = Government and government enterprises <- leaf; 84/85/86 are its children, excluded
--   Leaf industry codes (sum to the all-industry total, one row per
--   dashboard "industry"):
--     3, 6, 10, 11, 12, 34, 35, 36, 45, 51, 56, 60, 64, 65, 69, 70, 76, 79, 82, 83
--
-- The national total/breakdown is published as its own geo row in the same
-- table: geo_fips = '00000', geo_name = 'United States'.
--
-- These views are quarter-agnostic (one row per entity per quarter); the
-- endpoint picks the quarter it wants, typically the latest:
--   WHERE period_date = (SELECT MAX(period_date) FROM <view>)
-- See example queries at the bottom of this file.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Static state FIPS -> USPS code / name lookup.
--    geo_fips in the source is the 5-digit BEA GeoFIPS ("06000"); the 2-digit
--    state FIPS is its first two characters. '00' is the national total
--    (geo_fips = '00000'), included here so it can be joined/summed
--    alongside the states rather than treated as a separate case.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW bea.v_us_state_fips AS
SELECT * FROM (VALUES
    ('00', 'US', 'United States'),
    ('01', 'AL', 'Alabama'),        ('02', 'AK', 'Alaska'),
    ('04', 'AZ', 'Arizona'),        ('05', 'AR', 'Arkansas'),
    ('06', 'CA', 'California'),     ('08', 'CO', 'Colorado'),
    ('09', 'CT', 'Connecticut'),    ('10', 'DE', 'Delaware'),
    ('11', 'DC', 'District of Columbia'),
    ('12', 'FL', 'Florida'),        ('13', 'GA', 'Georgia'),
    ('15', 'HI', 'Hawaii'),         ('16', 'ID', 'Idaho'),
    ('17', 'IL', 'Illinois'),       ('18', 'IN', 'Indiana'),
    ('19', 'IA', 'Iowa'),           ('20', 'KS', 'Kansas'),
    ('21', 'KY', 'Kentucky'),       ('22', 'LA', 'Louisiana'),
    ('23', 'ME', 'Maine'),          ('24', 'MD', 'Maryland'),
    ('25', 'MA', 'Massachusetts'),  ('26', 'MI', 'Michigan'),
    ('27', 'MN', 'Minnesota'),      ('28', 'MS', 'Mississippi'),
    ('29', 'MO', 'Missouri'),       ('30', 'MT', 'Montana'),
    ('31', 'NE', 'Nebraska'),       ('32', 'NV', 'Nevada'),
    ('33', 'NH', 'New Hampshire'),  ('34', 'NJ', 'New Jersey'),
    ('35', 'NM', 'New Mexico'),     ('36', 'NY', 'New York'),
    ('37', 'NC', 'North Carolina'), ('38', 'ND', 'North Dakota'),
    ('39', 'OH', 'Ohio'),           ('40', 'OK', 'Oklahoma'),
    ('41', 'OR', 'Oregon'),         ('42', 'PA', 'Pennsylvania'),
    ('44', 'RI', 'Rhode Island'),   ('45', 'SC', 'South Carolina'),
    ('46', 'SD', 'South Dakota'),   ('47', 'TN', 'Tennessee'),
    ('48', 'TX', 'Texas'),          ('49', 'UT', 'Utah'),
    ('50', 'VT', 'Vermont'),        ('51', 'VA', 'Virginia'),
    ('53', 'WA', 'Washington'),     ('54', 'WV', 'West Virginia'),
    ('55', 'WI', 'Wisconsin'),      ('56', 'WY', 'Wyoming')
) AS t (state_fips, state_code, state_name);


-- -----------------------------------------------------------------------------
-- 1. Per-state, all-industry-total real GDP by quarter, with QoQ/YoY growth.
--    One row per (state, quarter), plus the US national total row
--    (geo_fips = '00000' -> state_fips = '00') for summation/comparison.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW bea.v_sqgdp_state_totals_quarterly AS
WITH totals AS (
    SELECT
        geo_fips,
        geo_name,
        period_date,
        year,
        quarter,
        value AS gdp_millions
    FROM bea.sqgdp_state_gdp
    WHERE table_name = 'SQGDP9'
      AND line_code = 1
),
with_lags AS (
    SELECT
        *,
        LAG(gdp_millions, 1) OVER (PARTITION BY geo_fips ORDER BY period_date) AS prev_q_gdp_millions,
        LAG(gdp_millions, 4) OVER (PARTITION BY geo_fips ORDER BY period_date) AS prev_y_gdp_millions
    FROM totals
)
SELECT
    geo_fips,
    SUBSTR(geo_fips, 1, 2) AS state_fips,
    geo_name AS state_name,
    period_date,
    year,
    quarter,
    gdp_millions,
    ROUND((gdp_millions - prev_q_gdp_millions) / prev_q_gdp_millions * 100, 2) AS qoq_pct_change,
    ROUND((gdp_millions - prev_y_gdp_millions) / prev_y_gdp_millions * 100, 2) AS yoy_pct_change
FROM with_lags;


-- -----------------------------------------------------------------------------
-- 2. Per-state leading industry by quarter (top real-GDP industry among the
--    20 leaf NAICS-level line codes), plus the US national total row
--    (geo_fips = '00000') for summation/comparison at the national level.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW bea.v_sqgdp_state_leading_industry_quarterly AS
WITH industry_rows AS (
    SELECT
        geo_fips,
        period_date,
        TRIM(description) AS industry,
        value AS gdp_millions,
        ROW_NUMBER() OVER (
            PARTITION BY geo_fips, period_date ORDER BY value DESC
        ) AS industry_rank
    FROM bea.sqgdp_state_gdp
    WHERE table_name = 'SQGDP9'
      AND line_code IN (3, 6, 10, 11, 12, 34, 35, 36, 45, 51, 56, 60, 64, 65, 69, 70, 76, 79, 82, 83)
)
SELECT
    geo_fips,
    period_date,
    industry AS leading_industry,
    gdp_millions AS leading_industry_gdp_millions
FROM industry_rows
WHERE industry_rank = 1;


-- -----------------------------------------------------------------------------
-- 3. Combined per-state view -- feeds the state map, ranking table, and
--    "fastest growing" table. Endpoint filters to one quarter (see examples).
--    Includes a state_fips = '00' / state_code = 'US' row for the national
--    total (e.g. to validate that state values sum to it) -- filter it out
--    downstream (WHERE state_fips <> '00') for views that should be
--    states-only, like the map or ranking table.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW bea.v_us_state_gdp AS
SELECT
    t.state_fips,
    f.state_code,
    t.state_name,
    t.period_date,
    t.year,
    t.quarter,
    t.gdp_millions,
    t.qoq_pct_change,
    t.yoy_pct_change,
    li.leading_industry
FROM bea.v_sqgdp_state_totals_quarterly t
LEFT JOIN bea.v_us_state_fips f
    ON f.state_fips = t.state_fips
LEFT JOIN bea.v_sqgdp_state_leading_industry_quarterly li
    ON li.geo_fips = t.geo_fips
   AND li.period_date = t.period_date;


-- -----------------------------------------------------------------------------
-- 4. National real GDP total by quarter, with QoQ/YoY growth. Feeds the
--    "National real GDP" / "QoQ" / "YoY" metric cards.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW bea.v_us_national_gdp AS
WITH totals AS (
    SELECT period_date, year, quarter, value AS gdp_millions
    FROM bea.sqgdp_state_gdp
    WHERE table_name = 'SQGDP9'
      AND line_code = 1
      AND geo_name = 'United States'
),
with_lags AS (
    SELECT
        *,
        LAG(gdp_millions, 1) OVER (ORDER BY period_date) AS prev_q_gdp_millions,
        LAG(gdp_millions, 4) OVER (ORDER BY period_date) AS prev_y_gdp_millions
    FROM totals
)
SELECT
    period_date,
    year,
    quarter,
    gdp_millions,
    ROUND((gdp_millions - prev_q_gdp_millions) / prev_q_gdp_millions * 100, 2) AS qoq_pct_change,
    ROUND((gdp_millions - prev_y_gdp_millions) / prev_y_gdp_millions * 100, 2) AS yoy_pct_change
FROM with_lags;


-- -----------------------------------------------------------------------------
-- 5. National GDP-by-industry mix by quarter: share of total, QoQ, YoY.
--    Feeds the "GDP by industry" table (and "leading industry" metric card).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW bea.v_us_industry_gdp AS
WITH industry_rows AS (
    SELECT
        period_date,
        year,
        quarter,
        TRIM(description) AS industry,
        value AS gdp_millions
    FROM bea.sqgdp_state_gdp
    WHERE table_name = 'SQGDP9'
      AND geo_name = 'United States'
      AND line_code IN (3, 6, 10, 11, 12, 34, 35, 36, 45, 51, 56, 60, 64, 65, 69, 70, 76, 79, 82, 83)
),
national_total AS (
    SELECT period_date, value AS national_gdp_millions
    FROM bea.sqgdp_state_gdp
    WHERE table_name = 'SQGDP9'
      AND line_code = 1
      AND geo_name = 'United States'
),
with_lags AS (
    SELECT
        i.*,
        n.national_gdp_millions,
        LAG(i.gdp_millions, 1) OVER (PARTITION BY i.industry ORDER BY i.period_date) AS prev_q_gdp_millions,
        LAG(i.gdp_millions, 4) OVER (PARTITION BY i.industry ORDER BY i.period_date) AS prev_y_gdp_millions
    FROM industry_rows i
    JOIN national_total n ON n.period_date = i.period_date
)
SELECT
    industry,
    period_date,
    year,
    quarter,
    gdp_millions,
    ROUND(gdp_millions / national_gdp_millions * 100, 1) AS share_pct,
    ROUND((gdp_millions - prev_q_gdp_millions) / prev_q_gdp_millions * 100, 2) AS qoq_pct_change,
    ROUND((gdp_millions - prev_y_gdp_millions) / prev_y_gdp_millions * 100, 2) AS yoy_pct_change
FROM with_lags;


-- =============================================================================
-- Example queries the endpoint would run against these views (latest quarter)
-- =============================================================================

-- National metric cards:
-- SELECT * FROM bea.v_us_national_gdp
-- WHERE period_date = (SELECT MAX(period_date) FROM bea.v_us_national_gdp);

-- State map + ranking table:
-- SELECT * FROM bea.v_us_state_gdp
-- WHERE period_date = (SELECT MAX(period_date) FROM bea.v_us_state_gdp)
-- ORDER BY gdp_millions DESC;

-- Industry mix table:
-- SELECT * FROM bea.v_us_industry_gdp
-- WHERE period_date = (SELECT MAX(period_date) FROM bea.v_us_industry_gdp)
-- ORDER BY gdp_millions DESC;
