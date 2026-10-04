# Flake Diff — Pass vs Fail (Production Grade 1.0.0)

Java + Selenium + Allure has screenshots but no structured **PASS vs FAIL diff**. Flake Diff fixes that.

## What it does
Capture deterministic, PII-safe snapshot on every test (PASS or FAIL) → attach to Allure → offline diff PASS (yesterday) vs FAIL (today) in 1s → hero Verdict + red chips tell you the cause.

## Install

### Java lib (copy 2 files, no Maven required for V1)
Copy `java/FlakeSnapshot.java` + `java/FlakeSnapshotListener.java` into `src/test/java/com/test/utils/`.
Add to `pom.xml`:
```xml
<dependency><groupId>com.google.code.gson</groupId><artifactId>gson</artifactId><version>2.10.1</version></dependency>
<dependency><groupId>io.qameta.allure</groupId><artifactId>allure-testng</artifactId><version>2.24.0</version></dependency>
```
Or from Maven Central (after publish): `io.github.flakediff:flake-snapshot:1.0.0` via `flake-diff/pom.xml`.

### TestNG setup
```xml
<listeners>
  <listener class-name="io.qameta.allure.testng.AllureTestNg"/>
  <listener class-name="com.test.utils.FlakeSnapshotListener"/>
</listeners>
```
Set driver: `FlakeSnapshotListener.DRIVER.set(driver)` in `@BeforeMethod`.

### Extension (offline, 0 permissions)
`chrome://extensions` → Developer mode → Load unpacked → select `extension/` folder  
Or open `extension/app.html` as `file://` (no install).

## Usage
1. `mvn test -Dheadless=true` → snapshots in `target/snapshots/snapshot-*.json` + Allure attachment.
2. Download PASS (yesterday green) + FAIL (today red) snapshot.json from Allure.
3. Drop both into extension → **Verdict card** (e.g., `Missing element: btn-pay gone in FAIL`) → red chips (URL, DOM, Console, Storage, TestIds).

## Budgets (hard limits)
- Capture <300ms p95, single JS pass
- JSON <1MB, `htmlSnippet` 20k, `bodyText` 2k, `localStorage` 10 keys × 500 chars
- Cookies 20 max, errors 20 max

## Privacy
- `redact=true` (default): storage emits `{key, valueHash, size}` only — no `preview`/`raw`. Cookies emit `valueHash` only. HTML inputs redacted.
- Set `REDACT=false` for local debug only.

## Demo
```bash
cd sample-selenium
mvn test -Dheadless=true   # 1 PASS + 1 FAIL (flake via ?flake=1)
# fixtures in flake-diff/fixtures/ also work without running Selenium:
# drag pass.snapshot.json + fail.snapshot.json into extension → see verdict
```

## Musk Decisions (why not to automate more)
- Deleted: HAR proxy, backend, AI, Allure plugin, jQuery demo duplicate — waste for V1.
- Simplified: 1 util file, 1 HTML page, flat JSON schema 2.0.
- Accelerated: fixtures + Jest-less pure `compare()` unit tests <1s (CI <4min).
- Automated: CI (build + PII guard) + zip script only. Judgment stays manual.

## Verification
```bash
mvn -f flake-diff/pom.xml verify
mvn -f sample-selenium/pom.xml test -Dheadless=true
# snapshots <1MB, no preview fields, diff <1s
```

## Packaging
```bash
# extension zip for Chrome Web Store
powershell -Command "Compress-Archive -Path flake-diff/extension/* -DestinationPath flake-diff/extension.zip -Force"
# or: zip -r flake-diff/extension.zip flake-diff/extension -x "*.DS_Store"
```

## License
MIT — see root `LICENSE`.
