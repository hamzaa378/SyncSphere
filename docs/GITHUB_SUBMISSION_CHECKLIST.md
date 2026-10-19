# GitHub release checklist — SyncSphere V2.3

## Before publishing

- [ ] Extract the release ZIP. The directory containing `README.md` and `package.json` is the GitHub repository root.
- [ ] Run `npm start` and open the page in three tabs on the same origin.
- [ ] Run `npm install` followed by `npm test` (baseline: 23/23 tests passed).
- [ ] Run `python tests/browser_v23.py http://localhost:5173` with the local server still running.
- [ ] Run `python scripts/verify_evidence.py <JSON-path> <CSV-path>` on that run's matching export pair.
- [ ] Test theme, language and font across tabs, persistence after all tabs close, and no incorrect first theme flash.
- [ ] Show 20 logical collision trials, normal fan-out, drop-first, delay-150 and mixed fault behavior.
- [ ] Confirm `tests/artifacts/` and `node_modules/` will not be committed by default.
- [ ] **Optional but recommended:** copy verified V2.3 raw JSON/CSV from `tests/artifacts/v23_latest/` into `evidence/v2_3_browser_validation/` for GitHub.
- [ ] Check `docs/EVIDENCE_AND_RESULTS.md` and distinguish owner-supplied test output from raw data and historical versions.
- [ ] Remove any local usernames, absolute Windows paths, API keys, tokens or unrelated personal files before making the repository public.
- [ ] Check `README.md`, `docs/SETUP_GUIDE.md`, and links display correctly on GitHub.
- [ ] Decide whether you want to add a license; no permission terms were presumed.

## Publish

- [ ] Create an empty public GitHub repository for the GDG submission.
- [ ] Push/commit all extracted project files, including `src/`, `dist/`, `tests/`, `.github/`, `docs/`, `assets/` and `evidence/`.
- [ ] Check the GitHub Actions `CI` workflow runs and passes once published. A newly published workflow was not already verified remotely.
- [ ] Optional: set up GitHub Pages or another static host; verify the deployed URL in two tabs before adding it to the README.
- [ ] Add GitHub repo URL and verified deployment URL (if available) to submission form.
- [ ] Record a short 3–4 minute demo using `docs/DEMO_SCRIPT_V2_3.md`.

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for copy-paste setup and Git commands.
