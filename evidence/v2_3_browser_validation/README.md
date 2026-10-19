# V2.3 browser raw evidence — add after local run

Original V2.3 JSON/CSV files were **not provided** to the packaging session. This folder intentionally contains **no synthetic benchmark sample data**.

Copy genuine Playwright output from `tests/artifacts/v23_latest/` to this folder when available:

```powershell
Copy-Item .\tests\artifacts\v23_latest\syncsphere-v2.3-evidence.json .\evidence\v2_3_browser_validation\
Copy-Item .\tests\artifacts\v23_latest\syncsphere-v2.3-samples.csv .\evidence\v2_3_browser_validation\
```

Validate the pair with `python scripts/verify_evidence.py` before committing. The JSON has the last fault mode only (Mixed) and a successful full Playwright test exports 144 rows.

The owner-provided terminal results are transcribed in `docs/EVIDENCE_AND_RESULTS.md`, including the caveats.
