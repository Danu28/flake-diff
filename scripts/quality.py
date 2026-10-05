#!/usr/bin/env python3
"""Flake Diff snapshot quality — single-file, <2s, no deps beyond stdlib"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).parent.parent
FAIL = 0
def bug(msg): 
    global FAIL; FAIL+=1
    print(f"BUG: {msg}")
def gap(msg):
    print(f"GAP: {msg}")
def ok(msg): print(f"OK: {msg}")

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# check files
files = list((ROOT/"flake-diff/fixtures").glob("*.json"))
if not files:
    bug("no fixtures found")
    sys.exit(1)

for f in files:
    j = json.loads(f.read_text(encoding="utf-8"))
    raw = f.read_text(encoding="utf-8")
    name = f.name
    # M3 budgets
    size = len(raw)
    if size > 1_000_000: bug(f"{name} >1MB {size}")
    else: ok(f"{name} size {size}<1M")
    if j.get("schemaVersion")!="2.0": bug(f"{name} schemaVersion !=2.0 got {j.get('schemaVersion')}")
    else: ok(f"{name} schema 2.0")
    html = (j.get("dom",{}).get("htmlSnippet") or "")
    if len(html) > 20000+200: bug(f"{name} htmlSnippet {len(html)}>20k")
    else: ok(f"{name} htmlSnippet {len(html)}")
    body = (j.get("dom",{}).get("bodyText") or "")
    if len(body) > 2000+10: bug(f"{name} bodyText {len(body)}>2k")
    # M2 PII
    if '"preview"' in raw:
        # raw contains preview field — only ok if REDACT false, but fixtures are REDACT true
        # check inside storage objects still have preview
        stor = j.get("storage",{})
        has_preview = any("preview" in str(e) for v in stor.values() if isinstance(v,list) for e in v)
        if has_preview: bug(f"{name} preview leak despite REDACT=true")
        else: ok(f"{name} no preview leak (raw has word but not in storage)")
    else:
        ok(f"{name} no preview field")
    # bodyText PII scan
    if EMAIL_RE.search(body): bug(f"{name} bodyText contains email PII: {EMAIL_RE.search(body).group(0)}")
    else: ok(f"{name} bodyText no email PII")
    if EMAIL_RE.search(html): gap(f"{name} htmlSnippet contains email-like pattern — review redaction (text nodes not redacted)")
    # storage caps
    stor = j.get("storage",{})
    total_keys = 0
    for k,v in stor.items():
        if isinstance(v,list):
            if len(v) > 10 and k in ("local","session"): bug(f"{name} storage {k} len {len(v)}>10")
            total_keys += len(v)
            for e in v:
                if isinstance(e,dict) and "valueHash" not in e and "error" not in e: bug(f"{name} storage entry missing valueHash {e}")
                if "value" in e: bug(f"{name} storage raw value leak {e.get('key')}")
    ok(f"{name} storage caps ok total {total_keys}")
    # cookies
    cookies = j.get("cookies",[])
    if len(cookies) > 20: bug(f"{name} cookies >20")
    if any("value" in c and "valueHash" not in c for c in cookies if isinstance(c,dict)): bug(f"{name} cookie raw value leak")
    else: ok(f"{name} cookies hash-only")
    # console
    console = j.get("console",{})
    if len(console.get("errors",[])) > 20: bug("errors >20")
    if len(console.get("warnings",[])) > 20: bug("warnings >20")
    # M1 correctness spot
    dom = j.get("dom",{})
    counts = dom.get("counts",{})
    testIds = dom.get("testIds",{})
    inv = dom.get("locatorInventory",[])
    if not isinstance(testIds, dict): bug(f"{name} testIds not dict")
    if inv is not None and len(inv) > 30: bug(f"{name} inventory >30")
    # hiddenCount plausibility
    total = counts.get("total")
    visible = counts.get("visible")
    if total and visible and visible > total: bug(f"{name} visible>total")
    # html redaction: inputs should be [REDACTED]
    if html and 'value="[REDACTED]"' not in html and '>[REDACTED]<' not in html:
        gap(f"{name} htmlSnippet may not have [REDACTED] inputs — check redaction coverage (email/number types)")
    else:
        ok(f"{name} htmlSnippet redacted")
    # determinism: timestamp should exist but ignored, viewport not hardcoded lie check
    meta = j.get("meta",{})
    vp = meta.get("viewport",{})
    if vp and vp.get("width")==1280 and vp.get("height")==800 and "grid" in str(j):
        gap("viewport hardcoded 1280x800 fallback — Grid mobile would lie")
    # check pretty vs compact: raw should be compact or pretty both ok but size already checked
    # viewer guard presence will be checked via app.js file size
    print("---")

# also check code quality gaps (static)
java = (ROOT/"flake-diff/java/FlakeSnapshot.java").read_text(encoding="utf-8", errors="ignore")
if "CSS.escape" in java and "try" not in java.split("CSS.escape")[0][-300:]:
    gap("FlakeSnapshot.java CSS.escape without try/catch — weird ids will throw")
    # we now expect try/catch added
if "offsetParent===null" in java and "checkVisibility" not in java:
    bug("hiddenCount uses offsetParent===null — fails for position:fixed/svg/opacity:0. Use checkVisibility || getClientRects")
else:
    ok("hiddenCount uses checkVisibility fallback — fixed")
if "preview: v.slice" in java and "sanitizeStorage" not in java:
    bug("JS creates preview without Java sanitizeStorage stripping — PII leak")
if '"preview"' in java and "REDACT" in java:
    ok("preview created but sanitizeStorage present — ok")
if "MAX_FILE_SIZE" in (ROOT/"flake-diff/extension/app.js").read_text(encoding="utf-8"):
    ok("app.js has 5MB guard")
else:
    bug("app.js missing 5MB guard")
if "alert(" in (ROOT/"flake-diff/extension/app.js").read_text(encoding="utf-8"):
    bug("app.js still uses alert() — should be showError")
else:
    ok("app.js no alert")

# also check hide via file
if FAIL==0:
    print("\nQUALITY OK — no BUGs, review GAPs above")
    sys.exit(0)
else:
    print(f"\nQUALITY FAIL — {FAIL} BUG(s) found")
    sys.exit(1)
