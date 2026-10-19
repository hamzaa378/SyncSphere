# SyncSphere V2.3 — Installation, testing, and GitHub publishing

This is the **current setup guide**. It assumes the V2.3 GitHub Release ZIP has been extracted and you can see `package.json` in its top-level project folder. **Do not upload the ZIP as a single file to GitHub** if the goal is a readable source repository: upload the extracted contents.

## A. Requirements

| Component | Required for | Version / note |
| --- | --- | --- |
| Windows PowerShell (or Terminal on macOS/Linux) | Start and test locally | Any supported shell |
| Node.js and npm | Local HTTP server | Node.js >=18, 22 recommended |
| Browser | Manual demonstration | Current Chrome or Edge recommended |
| Python | Automated browser testing and JSON/CSV validation | Python 3.9+ recommended |
| Playwright Python package + Chromium | Automated end-to-end run | Install only for E2E testing |
| Git | Command-line GitHub upload | Optional if using GitHub's browser upload |

No DB, API credentials, environment variables, account, or additional backend service are necessary.

Check installed software (PowerShell):

```powershell
node --version
npm --version
python --version
git --version
```

`git` is optional. If PowerShell blocks running `npm.ps1`, use `npm.cmd start`, `npm.cmd install`, etc., or change policy only if allowed by your institution. Do not run code with elevated privileges unless actually needed.

## B. Extract and locate the project

1. Download and extract the release ZIP to a new directory, e.g. `C:\Projects\SyncSphere`.
2. Open the extracted directory, then the inner project folder if your unzip program created one.
3. Confirm these files appear **together**: `README.md`, `package.json`, `index.html`, `src/`, `dist/`, `docs/`, `tests/`.
4. In File Explorer's address bar enter `powershell` to open a terminal in that exact folder, or use `cd`.

PowerShell path example (change it to your own path):

```powershell
cd "C:\Projects\SyncSphere"
Test-Path .\package.json
```

The final command should say `True`. If not, you are one level above or below the project root.

## C. First run — no npm installation necessary

```powershell
npm start
```

Expected: a message saying `SyncSphere running at http://localhost:5173`.

Open <http://localhost:5173>. Do **not** double-click `index.html`; `file://` origins do not reliably support this app's storage and messaging model.

If port 5173 is already used by another project, stop the old server or use a new port:

```powershell
$env:PORT = "5183"
npm start
```

Open <http://localhost:5183> in **every** testing tab, and pass this exact URL to browser testing. `localhost:5173` and `localhost:5183` are different origins and cannot synchronize.

To stop the server: press `Ctrl+C` in its terminal. Keep this terminal open during testing.

## D. Development and unit tests

Open a **second** terminal in the same directory:

```powershell
npm install
npm run build
npm test
```

`npm install` downloads the pinned TypeScript 5.8.3 developer dependency. The project has **no browser runtime dependencies**. `npm test` rebuilds TypeScript and runs native Node tests; the original V2.3 suite has **23 tests**. If you change TypeScript sources, run `npm run build` before using `npm start` again, or run `npm run dev` to rebuild and start the server. `npm run watch` compiles on changes but requires a separate running server.

On macOS/Linux:

```bash
npm start
# in a separate terminal:
npm install && npm test
```

## E. Manual acceptance test (three tabs)

1. Open three visible browser tabs/windows using the same profile, exact host and port.
2. Wait until the coordinator shows **3 tabs detected** (it sees 2 peers).
3. Change **theme** in Tab A; check Tabs B and C change without reload.
4. Change **language** in Tab B; check A and C update.
5. Change **font size** in Tab C; check A and B update.
6. Use the real-time status panel to inspect agreement and stamps. When all have matching stamps, it should say **converged**.
7. With dark mode enabled, close all tabs and reopen the app; the theme should initialize before the first visible render. Check language and font too.
8. On Tab A, run **100 updates** and **20 collisions**; check completed counts and no unexpected failure.
9. With all three tabs open, run fan-out **Normal**, **Drop first**, **Delay 150**, then **Mixed**. Expected normal outcomes: `24/24, 0 recovered`; `24/24, 24 recovered`; `24/24, 0 recovered`; `24/24, 12 recovered` respectively.
10. Export separate JSON/CSV pairs for scenarios and inspect the documented limitations.

**Important:** The injected 150-ms delay is a deliberate lab perturbation; its >100-ms RTT is expected. Normal ACK RTT is the main *protocol* performance indicator; you should also observe actual preference synchronization rather than treating the lab benchmark as UI-paint proof.

For repeatability, keep the number of tabs, machine, browser version, viewport layout and visibility similar. Perform one clearly labeled warm-up, then three separately saved normal runs. Preserve every result, including outliers. **Expect broadly comparable behavior, not identical timing decimals.** For more detail, use [TEST_INSTRUCTIONS_V2_3.md](TEST_INSTRUCTIONS_V2_3.md).

## F. Full Chromium automated acceptance test

Keep `npm start` running in Terminal 1. In Terminal 2:

```powershell
python -m pip install playwright
python -m playwright install chromium
python tests/browser_v23.py http://localhost:5173
```

For a custom port, change the script URL accordingly. The test opens an **isolated temporary Playwright browser context**, distinct from your manual tabs. It runs 100 updates, 20 conflicts, all four fault modes, actual font synchronization, convergence, reopening, and JSON/CSV export.

Expected success ending: `PASS: 3 Chromium tabs; 100 benchmarks, 20 stress trials, 4 fanout modes, persistence, 144 evidence rows`.

The result files are written here (and ignored by Git to avoid committing every incidental run):

```text
tests/artifacts/v23_latest/syncsphere-v2.3-evidence.json
tests/artifacts/v23_latest/syncsphere-v2.3-samples.csv
```

Independent evidence validation (PowerShell):

```powershell
python scripts/verify_evidence.py `
  ".\tests\artifacts\v23_latest\syncsphere-v2.3-evidence.json" `
  ".\tests\artifacts\v23_latest\syncsphere-v2.3-samples.csv"
```

The **144 records** comprise 100 benchmarks + 20 collisions + **24 from the final Mixed fan-out**, even though the script **runs** all four fan-out modes. The four modes appear in the terminal transcript; use separate exports if you need raw samples for all modes. This is expected, not data loss.

To preserve your own raw evidence for GitHub, copy it to the nonignored evidence directory:

```powershell
Copy-Item .\tests\artifacts\v23_latest\syncsphere-v2.3-evidence.json .\evidence\v2_3_browser_validation\
Copy-Item .\tests\artifacts\v23_latest\syncsphere-v2.3-samples.csv .\evidence\v2_3_browser_validation\
```

Read [EVIDENCE_AND_RESULTS.md](EVIDENCE_AND_RESULTS.md) for the provenance of reported results and how to cite them.

## G. Upload extracted files to GitHub

### Option 1 — GitHub web interface

1. Log into GitHub and choose **New repository**. Suggested name: `SyncSphere-GDG-Frontend-Task1`.
2. Choose **Public** if the submission requires a public repository. **Do not pre-create a README, .gitignore, or license** in this case, because your project already has README and .gitignore (you can add a license later).
3. Click **Create repository**, then **uploading an existing file**. Drag the contents of the extracted project folder, including folders such as `src`, `docs`, `dist`, `tests`, and `evidence`.
4. GitHub's web uploader may not preserve all folders or large selections conveniently. Confirm the nested paths appeared. The Git CLI below is more reliable for a full project.
5. Commit, open the repository, and confirm GitHub displays the root README and the source tree.

### Option 2 — Git command line (recommended)

First create an **empty repository** on GitHub (no starter README). Then, in PowerShell in your extracted project root:

```powershell
git init -b main
git add .
git status
git commit -m "Release SyncSphere v2.3 for GDG Frontend Task 1"
git remote add origin https://github.com/YOUR_USERNAME/SyncSphere-GDG-Frontend-Task1.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your own account. GitHub may request authentication through your browser or credential manager. Use GitHub's documented personal access token/SSH flow if prompted; **do not put tokens in files or send them in messages**.

If your project folder is already a Git repository, **do not run `git init` again**; inspect `git remote -v` and push to the correct repository. If `git commit` requests your identity, configure `git config user.name` and `git config user.email` with the identity you want commits to display.

### Optional static deployment

Because the committed `dist/` contains compiled JS, the site can run on a static host (for example GitHub Pages). On GitHub, open **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save. Wait for GitHub to show the site URL and verify `index.html`, CSS and JavaScript load. This depends on the repository's available Pages settings and hosting behavior. The live website is optional in the original challenge if available; do not claim it exists until verified.

## H. Troubleshooting

| Symptom | Check |
| --- | --- |
| `npm` / `node` not recognized | Install Node.js; restart the terminal; check PATH |
| `package.json` not found | `cd` to the project root; `Test-Path .\package.json` should be `True` |
| `npm.ps1 cannot be loaded` | Run `npm.cmd start`, or use an allowed PowerShell execution policy |
| `EADDRINUSE` / port occupied | Close the old server or set `$env:PORT = "5183"` |
| App page blank | Use `http://localhost:<port>` not `file://`; inspect browser console; ensure `dist/` exists |
| Other tabs not detected | Same profile, browser storage partition, exact host and port; no private window |
| Tests say no peers | Wait for discovery; keep tabs active; avoid mixing V2.2 and V2.3 instances |
| Browser test fails to launch Chromium | Run `python -m playwright install chromium` after pip install |
| `npm test` fails without `tsc` | Run `npm install`; `npm start` alone does not install dev dependencies |
| Export verifier reports mismatch | Pair JSON and CSV from the **same** export/run, not different rounds |
| High RTT when minimized | Background throttling can delay timers; note conditions and rerun visible |
| GitHub upload missing folders | Upload project **contents** with Git CLI; inspect the pushed tree |

## I. Final pre-submission check

Run `npm test`, run the Chromium test, validate its report, inspect the web UI and mobile layout, and check the GitHub README/architecture/limitations. Do not commit `node_modules/`, credentials, generated incidental artifacts or fictional performance metrics. See [GITHUB_SUBMISSION_CHECKLIST.md](GITHUB_SUBMISSION_CHECKLIST.md).
