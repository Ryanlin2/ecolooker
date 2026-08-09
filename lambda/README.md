# lambda

AWS Lambda-packaged ingestion code.

## imf/

Python package (`imf`, src layout) that pulls macroeconomic indicators from
the [IMF DataMapper API v2](https://www.imf.org/external/datamapper/api/help)
— GDP, PPP, and related series across countries — for use as a Lambda
function.

```
lambda/imf/
├── src/imf/              # package source
├── pyproject.toml        # setuptools build config, packaged as `imf`
├── build-layer.sh         # builds a Lambda layer zip from the package + deps
├── imf.ipynb              # exploratory notebook: pulling/shaping IMF data
├── imf_indicators_cheatsheet.md        # IMF indicator codes reference
└── imf_writeup_data_actuals_vs_projections.md  # notes on actuals vs. IMF projections
```

### Build the Lambda layer

```bash
cd lambda/imf
chmod +x build-layer.sh
./build-layer.sh
```

Produces a wheel under `dist/` and a layer zip suitable for attaching to a
Lambda function that imports `imf`.
