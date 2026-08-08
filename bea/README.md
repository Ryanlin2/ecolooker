# bea

Ingestion and analysis of state-level GDP data from the
[BEA (Bureau of Economic Analysis) Regional Data API](https://apps.bea.gov/api/signup/).

```
bea/
├── SQGDP.zip              # archived raw pull
└── sqgdp_data/
    ├── SQGDP/              # raw CSV exports, one file per table/geo
    ├── query.py            # loads a single SQGDP table/geo CSV into a tidy DataFrame
    ├── sqgdp.ipynb          # exploratory analysis notebook
    ├── .env                 # BEA API key (gitignored, not tracked)
    └── README.md            # full data dictionary: tables, geo/region codes,
                              # column structure, footer rows, query recipes
```

See [`sqgdp_data/README.md`](sqgdp_data/README.md) for the full breakdown of
available tables (SQGDP1/2/8/9/11), file naming, column structure, and query
recipes (e.g. "total US real GDP over time", "what drove a state's growth in
a quarter"). `query.py` is the entry point for loading a table into pandas.
