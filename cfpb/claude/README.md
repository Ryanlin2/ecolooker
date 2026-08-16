# cfpb/claude

`complaints-pipeline/` contains no pipeline code — only a test fixture,
`complaints-pipeline/tests/sample_complaints.csv` (7 example rows in the raw CFPB export
column layout: `Complaint ID`, `Product`, `Issue`, `Sub-issue`, `Date received`, etc. — the
same schema `cfpb_complaints_upsert.py`'s `RAW_SCHEMA`/`COLUMN_MAP` expects), plus a stray
`.DS_Store`. There's no ingestion, transform, or actual test code anywhere under this
directory. Both files are also gitignored (`*.csv`, `**/.DS_Store`) and untracked, so this
directory is local-only and won't exist for anyone else who clones the repo. Treat it as
inactive, unused scaffolding rather than part of the pipeline described in
[`../README.md`](../README.md).
