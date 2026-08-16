# lambda/imf

Python package (`imf`, src layout) that pulls macroeconomic indicators from the
[IMF DataMapper API v2](https://www.imf.org/external/datamapper/api/help), packaged as
an AWS Lambda layer. This is the ingestion piece for the third data source in the
[root README](../../README.md)'s architecture — CFPB and BEA both have Glue/Athena
pipelines already wired to the frontend; IMF currently stops at "layer builds and the
function imports cleanly," with no deployed Lambda/Glue/Athena stack yet (there is no
`terraform/` under `lambda/imf/`, unlike `bea/terraform/`).

```
lambda/imf/
├── src/imf/
│   ├── __init__.py                     # empty — package marker
│   └── get_raw_imf_json.py             # the entire package: one function
├── pyproject.toml                       # setuptools build config, packages as `imf`
├── build-layer.sh                       # builds a Lambda layer zip from the package + deps
├── help.md                              # two-line reminder of how to run build-layer.sh
├── imf.ipynb                            # exploratory notebook: pulling/shaping IMF data
├── imf_indicators_cheatsheet.md         # IMF indicator codes reference (WEO, FPP, FM, FSI, ...)
└── imf_writeup_data_actuals_vs_projections.md  # notes on actuals vs. IMF projections
```

## Package: `imf`

The whole package is one function, `get_raw_imf_json(indicator="NGDPD", start_year=1980,
end_year=2029)` in `src/imf/get_raw_imf_json.py`. It builds a period list from
`start_year`/`end_year`, calls `GET https://www.imf.org/external/datamapper/api/v2/{indicator}
?periods=...` with a 60s timeout, logs the URL/status/response body on failure, and returns
the parsed JSON response as-is — no DataFrame conversion, no CSV/JSON file writes. Shaping the
response into a usable table is left to the caller (see `imf.ipynb` for exploratory examples of
that step). `indicator` is any code from `imf_indicators_cheatsheet.md` (e.g. `NGDPD` for
nominal GDP in USD, `NGDP_RPCH` for real GDP growth, `PPPGDP` for PPP-adjusted GDP).

## Build the Lambda layer

```bash
cd lambda/imf
chmod +x build-layer.sh
./build-layer.sh
```

`build-layer.sh`:
1. Wipes prior build artifacts (`build/`, `dist/`, `*.egg-info`, `imf-layer.zip`, `.venv-build/`).
2. Creates an isolated venv (`.venv-build/`) so the build doesn't pick up anything from the
   ambient environment, and installs `pip`/`setuptools`/`wheel`/`build` into it.
3. Runs `python -m build --wheel` to produce a wheel under `dist/`.
4. Installs that wheel (and its one dependency, `requests`) into
   `build/python/lib/python3.11/site-packages` — the `python/lib/pythonX.Y/site-packages`
   layout is what the Lambda layer runtime expects on `sys.path`.
5. Sanity-checks the install by importing `get_raw_imf_json` with that directory on
   `PYTHONPATH`.
6. Zips `build/python` into `imf-layer.zip`.

Attach `imf-layer.zip` to a Lambda function running Python 3.11 to make `from imf.get_raw_imf_json
import get_raw_imf_json` importable inside the function.

## Reference docs

- [`imf_indicators_cheatsheet.md`](imf_indicators_cheatsheet.md) — indicator codes by dataset
  (WEO, FPP, FM, FSI, ...) with label, unit, and a one-line meaning for each; use this to pick
  the `indicator` argument.
- [`imf_writeup_data_actuals_vs_projections.md`](imf_writeup_data_actuals_vs_projections.md) —
  what the IMF/WEO is, how it collects data (national authorities → IMF country desks → IMF
  staff estimates/projections), and how to tell actuals apart from projections in the series.
- `imf.ipynb` — exploratory notebook for pulling data with `get_raw_imf_json` and shaping the
  response into a usable table.
