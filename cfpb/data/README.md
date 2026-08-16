# cfpb/data

Prototyping history for the CFPB pipeline — not part of the active pipeline.

## `cfpb.ipynb`

Exploratory notebook (109 cells) where the row-level cleaning rules were originally
worked out against a local raw complaints export: deduplication and missing-ID flagging
on `Complaint ID`, and mixed-ISO-8601 date parsing (`convert_column_to_datetime`) on
`Date received`, among others. It reads its input from `complaints.csv/complaints.csv`
(a local extraction path, see below).

These rules were later formalized into `cfpb_complaints_standardize.py`, and are now
applied inline inside `cfpb_complaints_upsert.py`'s `transform()` — see "Cleaning rules"
in [`../glue_jobs/README.md`](../glue_jobs/README.md) for the current, authoritative
implementation. This notebook is superseded and not run as part of the pipeline; it's
kept only as a record of how those rules were derived.

## `complaints.csv`

A local raw-data sample used for notebook exploration. It matches `*complaints.csv` /
`*.csv` in the repo's `.gitignore`, so it is **not tracked in git** and won't be present
in a fresh clone. Nothing else in the pipeline depends on it — only `cfpb.ipynb` reads it,
and that notebook is prototyping history, not an active job — so its absence doesn't
affect running any other part of `cfpb/`.
