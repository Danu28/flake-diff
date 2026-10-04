# Flake Diff — Pass vs Fail

[![CI](https://github.com/Danu28/flake-diff/actions/workflows/ci.yml/badge.svg)](https://github.com/Danu28/flake-diff/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-MV3-4f46e5?logo=googlechrome)](flake-diff/extension)
[![Java 11](https://img.shields.io/badge/Java-11-007396?logo=java)](flake-diff/java)

**Offline, PII-safe diff for flaky Selenium tests.** Screenshots tell you *that* it failed — Flake Diff tells you *why* in 30 seconds.

> **Problem:** Java+Selenium+Allure has screenshots but no structured PASS vs FAIL state. Triage takes 15–60 min.  
> **Solution:** One-call snapshot (`FlakeSnapshot.capture`) on every test → Allure attachment → offline viewer diffs PASS (yesterday) vs FAIL (today) → hero Verdict + red chips (missing `btn-pay`, new console errors, DOM delta).

![Verdict Demo](docs/screenshot-verdict.png)
*Verdict + chips → scan red cards only. Works offline as `file://`.*

## Features
- **One JS pass, <300 ms p95, <1 MB** — `htmlSnippet` 20k, `bodyText` 2k, 10 storage keys × 500 chars, 20 cookies/errors max
- **PII-safe by default** — `redact=true` emits `{key,valueHash,size}` only, no `preview`; cookies `valueHash`; inputs `[REDACTED]`
- **Offline & zero-permission** — MV3 `permissions: []`, `file://` works, 5 MB file guard, no backend
- **Production-grade** — MIT, versioned `1.0.0`, CI (headless Chrome), headless/ headed toggle, `WebDriverWait` not `Thread.sleep`

## Quick Start (60 s, no install)

### Option A — No Selenium (fixtures)
1. Open `flake-diff/extension/app.html` as `file://` (or Load unpacked in `chrome://extensions`)
2. Drag `flake-diff/fixtures/pass.snapshot.json` (PASS) + `fail.snapshot.json` (FAIL)
3. Read **Verdict**: `Missing element: btn-pay gone in FAIL` → red chips

### Option B — Run sample Selenium (headless)
```bash
cd sample-selenium
mvn test -Dheadless=true
# snapshots → target/snapshots/snapshot-testPass-PASS.json + snapshot-testFail_Flaky-FAIL.json + Allure
# then drop both into app.html as above
```

## Install — Java Lib
**V1 (copy 2 files, no Maven publish needed):**
Copy `flake-diff/java/FlakeSnapshot.java` + `FlakeSnapshotListener.java` into `src/test/java/com/test/utils/`
```xml
<!-- pom.xml -->
<dependency><groupId>com.google.code.gson</groupId><artifactId>gson</artifactId><version>2.10.1</version></dependency>
<dependency><groupId>io.qameta.allure</groupId><artifactId>allure-testng</artifactId><version>2.24.0</version></dependency>
```
**After Maven Central:** `io.github.flakediff:flake-snapshot:1.0.0` from `flake-diff/pom.xml`

**TestNG:**
```xml
<listeners>
  <listener class-name="io.qameta.allure.testng.AllureTestNg"/>
  <listener class-name="com.test.utils.FlakeSnapshotListener"/>
</listeners>
```
In `BaseTest@BeforeMethod`: `FlakeSnapshotListener.DRIVER.set(driver);`

## Install — Chrome Extension
- **Dev:** `chrome://extensions` → Developer mode → Load unpacked → `flake-diff/extension/`
- **File fallback:** double-click `flake-diff/extension/app.html` (no install, offline)
- Stores: `Compress-Archive -Path flake-diff/extension/* -DestinationPath flake-diff/extension.zip` → upload to Chrome Web Store

## How It Works
```
TestNG Test --(1 line)--> FlakeSnapshot.capture(driver,testName,status)
  | JS: DOM counts/testIds/inventory + console hook + storage hash + cookies
  v
Allure.addAttachment("snapshot-*.json") → target/snapshots/ → Allure Report
  |
Tester downloads PASS + FAIL json → Extension (offline) → deterministic diff → Verdict
```

## Project Structure
```
flake-diff/
  java/FlakeSnapshot.java + FlakeSnapshotListener.java + pom.xml (1.0.0)
  extension/app.html + app.js + manifest.json + icons (16/48/128/256) + popup
  fixtures/pass|fail.snapshot.json (sanitized, schema 2.0)
  README.md
demo-app/index.html          # deterministic ?flake=1 hides Pay
sample-selenium/             # TestNG + Allure, headless capable, WebDriverWait
docs/ideas.md                # 12 browser-extension ideas (Musk-filtered, not shipped)
.github/workflows/ci.yml     # Java 11, headless, PII guard, artifact upload
```

## Privacy & Budgets
- `redact=true` default — no `preview`, `valueHash` only. Set `REDACT=false` for local debug.
- Guard: 5 MB file guard (extension), 1 MB JSON, `htmlSnippet` escaped before `innerHTML`.

## Verification
```bash
mvn -f flake-diff/pom.xml verify
mvn -f sample-selenium/pom.xml test -Dheadless=true
# CI also checks: no preview leak, budgets, manifest lint
```

## Roadmap (Musk Delete = not in V1)
- ❌ HAR, backend, AI verdict — offline-only is a feature
- ✅ Next: Maven Central publish, Playwright port (if maintainer), Allure plugin rendering

## Contributing
See `CONTRIBUTING.md` — small, boring-tech PRs welcome. Keep `FlakeSnapshot.java` <400 lines, never throw.

## License
MIT — see `LICENSE`. Icons MIT.
