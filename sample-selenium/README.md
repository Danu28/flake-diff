# Sample Selenium — Flake Diff Demo

## Run
```bash
cd sample-selenium
mvn test
# allure results in target/allure-results/
# snapshots: target/allure-results/*snapshot-*.json  (also attached to allure report)
mvn allure:serve   # optional, opens report
```

## What it tests
- `testPass` — opens `demo-app/index.html` (file://), login -> add product -> checkout, expects `btn-pay` visible -> PASS snapshot
- `testFail_Flaky` — same but opens `?flake=1` (demo-app hides btn-pay + console.error) -> FAIL snapshot

## Verify with extension
1. After `mvn test`, find 2 snapshot.json in `target/allure-results/` or download from `target/allure-report` / `allure-results`
2. Or copy from `target/allure-results/*snapshot-*.json` -> rename to pass/fail
3. Open `flake-diff/extension/app.html` (or extension full page) -> drop PASS vs FAIL -> verdict `Missing btn-pay` + 2 new console errors

## No server needed
Demo app is static `demo-app/index.html` SPA, works via `file://` with `--allow-file-access-from-files`.

## Fixtures fallback
If mvn not available, use prebuilt `flake-diff/fixtures/pass|fail.snapshot.json` to demo extension without running tests.
