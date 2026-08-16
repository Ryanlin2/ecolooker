# lambda

AWS Lambda-packaged ingestion code.

## [`imf/`](imf)

Python package (`imf`, src layout) that pulls macroeconomic indicators from
the [IMF DataMapper API v2](https://www.imf.org/external/datamapper/api/help)
— GDP, PPP, and related series across countries — packaged as a Lambda layer.
See [`imf/README.md`](imf/README.md) for the function reference, indicator
codes, and the `build-layer.sh` build step.

This is the least-built-out of the repo's three data sources (compare to
[`cfpb/`](../cfpb) and [`bea/`](../bea)): the fetch function exists, but there's
no Glue job landing its output, no Athena view, and no webapp dashboard
consuming it yet.
