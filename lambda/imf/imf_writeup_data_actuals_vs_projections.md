# IMF Data: Overview, Collection, and Projections

## What the IMF Is

The **International Monetary Fund (IMF)** is an international financial institution that monitors the global economy, provides policy advice, lends to countries facing balance-of-payments problems, and publishes economic data and forecasts.

For this project, the most relevant IMF product is usually the **World Economic Outlook (WEO)**. The WEO provides country-level and global macroeconomic indicators such as:

- GDP
- Inflation
- Unemployment
- Current-account balances
- Government debt
- Economic growth rates

The WEO is typically published around twice a year and includes both **historical data** and **forward-looking projections**.

## How the IMF Collects Its Data

IMF WEO data is assembled from a mix of:

1. **National-authority data**
2. **IMF country desk work**
3. **IMF staff estimates and projections**

In practical terms:

| Source type | Meaning |
|---|---|
| **National statistical agencies** | Provide official economic statistics such as GDP, prices, labor-market data, and trade data. |
| **Finance ministries** | Provide fiscal data such as government revenue, expenditure, deficits, and debt. |
| **Central banks** | Provide monetary, financial, exchange-rate, and balance-of-payments data. |
| **IMF country teams** | Review, standardize, estimate, and project country-level macroeconomic data. |

Historical values usually come from official country sources. When official data is incomplete, delayed, or inconsistent, IMF staff may produce estimates. Future values are IMF projections based on country analysis and shared global assumptions.

## Actuals, Estimates, and Projections

IMF datasets often contain more than one kind of value. The main distinction is between **real observed data** and **forecasted data**.

| Data type | Meaning | Should be treated as real? |
|---|---|---|
| **Actual / historical** | Observed data for past years, usually based on official country statistics. | Yes |
| **Estimate** | IMF-estimated value for a recent or incomplete historical period. | Mostly, but it may be revised later |
| **Projection** | IMF forecast for a future year. | No |

A **projection** is not a measured outcome. It is the IMF’s forecast of what the value may be under its assumptions at the time of publication.

## Which Values Are Projections?

For WEO-style annual data, the projection years are usually the future years included in the dataset.

For example, if you request data from **1980 through 2029**, then the older years are generally historical actuals or estimates, while the future years are projections.

As of **May 30, 2026**, a practical default classification is:

| Year range | Classification |
|---|---|
| **1980–2025** | Actual or estimate |
| **2026–2029** | Projection |

This is a useful default, but the safest approach is to check IMF metadata for the specific dataset or indicator when available.

## Getting the Data

IMF DataMapper data can be pulled from an endpoint like:

```text
https://www.imf.org/external/datamapper/api/v2/{INDICATOR}
```

For example, for GDP in current U.S. dollars using the `NGDPD` indicator:

```text
https://www.imf.org/external/datamapper/api/v2/NGDPD
```

When you request a range like `1980–2029`, the returned JSON may include both:

- **Historical actuals or estimates**
- **Future projections**

## Adding a Projection Flag to Your JSON

When transforming IMF data into your own JSON records, it is useful to add a field such as `data_type`.

Example:

```python
row = {
    "country_code": country_code,
    "country": country_name,
    "year": int(year),
    "value": value,
    "data_type": "projection" if int(year) >= 2026 else "actual_or_estimate",
}
```

This would produce records like:

```json
{
  "country_code": "USA",
  "country": "United States",
  "year": 2029,
  "value": 34500.0,
  "data_type": "projection"
}
```

## Recommended Classification Function

A reusable helper function can keep the classification logic clear:

```python
def classify_imf_observation(year, projection_start_year=2026):
    """
    Classify an IMF observation as actual/estimate or projection.

    Parameters
    ----------
    year : int
        Observation year.
    projection_start_year : int
        First year that should be treated as a projection.

    Returns
    -------
    str
        Either "actual_or_estimate" or "projection".
    """
    return "projection" if int(year) >= projection_start_year else "actual_or_estimate"
```

Usage:

```python
row = {
    "country_code": country_code,
    "country": country_name,
    "year": int(year),
    "value": value,
    "data_type": classify_imf_observation(year),
}
```

## Practical Rule for This Project

For a dataset covering **1980–2029**, use this convention unless IMF metadata says otherwise:

```python
"data_type": "projection" if int(year) >= 2026 else "actual_or_estimate"
```

That means:

- **1980–2025**: treat as historical actuals or IMF estimates
- **2026–2029**: treat as IMF projections

This keeps the JSON transparent and makes it clear which values are observed or estimated historical data versus forward-looking forecasts.
