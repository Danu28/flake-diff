# Contributing to Flake Diff

Thanks for considering contributing! This project is intentionally small and boring-tech — please read the Musk Delete list before proposing features.

## Quick Start
```bash
git clone https://github.com/Danu28/flake-diff.git
cd flake-diff
# or if cloned as new-ideas, cd new-ideas
mvn -f sample-selenium/pom.xml test -Dheadless=true
# open flake-diff/extension/app.html as file:// and drop fixtures
```

## How to Contribute
1. **Issues:** Use GitHub Issues for bugs/ideas. Include snapshot JSON snippet + browser version.
2. **PRs:** Fork → branch `feat/<name>` → keep diff small → run CI locally → PR.
3. **Code style:** 
   - Java: 11, no extra deps, `FlakeSnapshot.java` stays <400 lines, never throws.
   - JS: vanilla, no build, `app.js` stays <600 lines, `escape()` all user content.
4. **Tests:** `mvn -f flake-diff/pom.xml verify` + `mvn -f sample-selenium/pom.xml test -Dheadless=true` must pass. Add a fixture case if you change schema.

## What We Won't Merge (Musk Delete)
- Backend/service, HAR proxy, AI auto-classify, Allure plugin auto-render — V1 is offline-only.
- New frameworks (Cypress/Playwright) without a maintainer — open an issue first.
- Pretty-print JSON by default — budget is <1MB.

## Release
- Bump `flake-diff/pom.xml` version + `flake-diff/extension/manifest.json` version + `flake-diff/README.md` header.
- Tag `v1.0.x` → CI builds → GitHub Release → Chrome Web Store upload via `flake-diff/extension.zip`.

## Code of Conduct
Be kind, assume good intent. See `CODE_OF_CONDUCT.md` if added.

## License
By contributing you agree your work is under MIT.
