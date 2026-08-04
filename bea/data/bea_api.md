# BEA Data API — Regional Dataset

Reference notes for the API call used in `bea_gdp_industry_state.ipynb`
(`get_raw_bea_real_gdp_by_industry_state_json`).

## Official documentation

- **API User Guide (PDF)** — the authoritative reference, see *Appendix N – Regional*:
  https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf
- **Get an API key**: https://apps.bea.gov/api/signup/
- **BEA release schedule** (when new data lands): https://www.bea.gov/news/schedule

## How the API is structured

- Single endpoint: `https://apps.bea.gov/api/data`. Every request is an HTTP `GET` with
  querystring parameters — there are no other paths.
- Minimum required params on every request: `UserID` and `method`.
- `ResultFormat` is `JSON` or `XML` (defaults to `JSON` if omitted/invalid).
- The response root is always `BEAAPI`, containing:
  - `Request.RequestParam` — echoes back the params you sent
  - `Results` — shape depends on the method/dataset called
- **Rate limits** (per UserID, per rolling minute): 100 requests, 100 MB of data, or 30 errors.
  Exceeding any of these returns HTTP `429` with a `Retry-After` header (seconds to wait) and
  `APIErrorCode: 7` in the body.

### Methods

| Method | Purpose |
|---|---|
| `GetDatasetList` | List all datasets (NIPA, Regional, GDPbyIndustry, ...) |
| `GetParameterList` | List the parameters a given dataset accepts |
| `GetParameterValues` | List valid values for one parameter |
| `GetParameterValuesFiltered` | List valid values for one parameter, filtered by other params (e.g. valid `LineCode`s for a given `TableName`) |
| `GetData` | Actually retrieve data — this is what the notebook uses |

## The `Regional` dataset

`datasetname=Regional` covers income, employment, and GDP by state, county, and metro area —
everything in BEA's Regional Interactive Tables. `GetData` requires:

| Param | Required | Multi-value? | Notes |
|---|---|---|---|
| `TableName` | Yes | No | Exactly one published table code, e.g. `SQGDP9` |
| `LineCode` | Yes | No | One statistic/industry line number, or `ALL` for every line in the table |
| `GeoFips` | Yes | Yes* | `STATE`, `COUNTY`, `MSA`, `TERR`, a 2-letter state code, or a list of FIPS codes. *Only one `GeoFips` value is allowed when `LineCode=ALL`.* |
| `Year` | No | Yes | Comma-separated years, `LAST5`, `LAST10`, or `ALL`. Defaults to `LAST5` if omitted. |

> **Learned the hard way:** the doc's "only one `GeoFips` value" rule is stricter than it sounds.
> `GeoFips="STATE"` is a *single parameter value* syntactically, but BEA still rejects it when
> paired with `LineCode="ALL"` — the wildcard for "every industry" only works against one
> concrete geography (e.g. `GeoFips="01000"` for Alabama alone), not the `STATE`/`COUNTY`/`MSA`
> aggregate keywords. Live response for `LineCode=ALL&GeoFips=STATE`:
> ```json
> {"APIErrorCode": "41", "APIErrorDescription": "Multiple parameter values were supplied for a
> parameter that only allows single values.",
> "ErrorDetail": {"Description": "Only one geography can be submitted when LineCode value= ALL"}}
> ```
> **So a single call can't get "every industry × every state."** Pick one:
> - `GeoFips="STATE"` + one specific `LineCode` → all states/regions for one industry. (Works —
>   confirmed live, 60 geographies × N quarters per call.)
> - `LineCode="ALL"` + one specific `GeoFips` → all industries for one state.
>
> For "every industry, every state, full history," loop over `LineCode` (one `GetData` call per
> industry, each already pulling all states) and concatenate — `SQGDP9` has 27 industry line
> codes, so that's 27 calls, well under the 100/min rate limit. Fetch the valid codes dynamically
> with `GetParameterValuesFiltered` (`TargetParameter=LineCode`) rather than hardcoding them, in
> case BEA adds/renumbers industries later. This is what
> `get_bea_regional_line_codes()` + the loop in the notebook's second cell do.

### Error responses have a different shape than success responses

On error, `Results` is missing entirely — the error lives directly under `BEAAPI`:

```json
{"BEAAPI": {"Request": {...}, "Error": {"APIErrorCode": "41", "APIErrorDescription": "..."}}}
```

So `resp["BEAAPI"]["Results"]["Data"]` throws `KeyError: 'Results'` on failure, not a `KeyError`
on `"Data"`. Check for an `"Error"` key before indexing into `"Results"` if you want a clean error
message instead of a raw `KeyError`.

### Table used here: `SQGDP9`

From Appendix N's table list, the quarterly state-GDP tables are:

| TableName | Description | Years |
|---|---|---|
| `SQGDP1` | GDP by state summary (current dollars) | 2005→ |
| `SQGDP2` | GDP by state (current dollars, by industry) | 2005→ |
| `SQGDP8` | Quantity indexes for real GDP by state | 2005→ |
| **`SQGDP9`** | **Real GDP by state** (chained dollars, by industry) | **2005→** |
| `SQGDP11` | Contributions to percent change in real GDP | 2005→ |

`SQGDP9` is the one that matches "quarterly real GDP by state by industry" — it's inflation-adjusted
(chained-dollar) levels, broken out by industry line, on a quarterly cadence.

### Example requests

One industry, all states, full history (works in a single call):

```
https://apps.bea.gov/api/data/?UserID=YOUR-KEY&method=GetData&datasetname=Regional
  &TableName=SQGDP9&LineCode=1&GeoFips=STATE&Year=ALL&ResultFormat=JSON
```

Every industry: loop the above over each `LineCode` returned by:

```
https://apps.bea.gov/api/data/?UserID=YOUR-KEY&method=GetParameterValuesFiltered
  &datasetname=Regional&TargetParameter=LineCode&TableName=SQGDP9&ResultFormat=JSON
```

### Response shape

```json
{
  "BEAAPI": {
    "Request": { "RequestParam": [ ... ] },
    "Results": {
      "Statistic": "Real GDP by state",
      "UnitOfMeasure": "Millions of chained 2017 dollars",
      "Dimensions": [ ... ],
      "Data": [
        {
          "Code": "SQGDP9-1",
          "GeoFips": "01000",
          "GeoName": "Alabama",
          "TimePeriod": "2023Q1",
          "CL_UNIT": "Millions of chained 2017 dollars",
          "UNIT_MULT": "6",
          "DataValue": "228345.6"
        },
        ...
      ]
    }
  }
}
```

- `Code` — `TableName-LineCode`, so the industry is identified by the numeric suffix.
- `GeoFips` / `GeoName` — state FIPS code and name (or `"United States"` for the national total).
- `TimePeriod` — quarter, e.g. `"2023Q1"`.
- `DataValue` — the number itself; `UNIT_MULT` is the power-of-10 multiplier to apply if you need
  raw units instead of the pre-scaled value BEA already returns.

## Errors

- **`40`** — required parameter missing/invalid (e.g. bad `TableName`, or incompatible
  `TableName`/`GeoFips`/`LineCode`/`Year` combination).
- **`41`** — a multi-value-looking parameter was rejected as single-value-only. Hit this with
  `LineCode=ALL` + `GeoFips=STATE` (see callout above).
- **`203`** — no parameter values match the filters given (used by `GetParameterValuesFiltered`).
- **`7`** — throttled (see rate limits above); retry after the `Retry-After` header value.

## Mapping to the notebook

- **Cell 1** defines `get_raw_bea_real_gdp_by_industry_state_json()` (one `GetData` call:
  `datasetname=Regional`, `TableName=SQGDP9`, `GeoFips=STATE`, `Year=ALL`, and a caller-supplied
  `line_code`) and `get_bea_regional_line_codes()` (one `GetParameterValuesFiltered` call to list
  `SQGDP9`'s industry codes). Both read `BEA_API_KEY` from `.env.local`.
- **Cell 2** calls `get_bea_regional_line_codes()`, then loops `get_raw_bea_real_gdp_by_industry_state_json()`
  once per industry line code (`GeoFips="STATE"`, `Year="ALL"`, one `LineCode` per call), and
  concatenates the results into a single DataFrame — full history, every state, every industry.

## Environment gotcha

The notebook's kernel (`py313`, pointed at `/Users/ryan/venvs/py313/bin/python`) ships `pandas`
but not `requests` by default — `import requests` in cell 1 fails with `ModuleNotFoundError`
until it's installed into that venv (`/Users/ryan/venvs/py313/bin/python -m pip install requests`).
